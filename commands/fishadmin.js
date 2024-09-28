const { SlashCommandBuilder } = require('discord.js');
const logger = require('log4js').getLogger();

module.exports = {
	enabled: true,
	cooldown: 5,
	data: new SlashCommandBuilder()
		.setName('fishadmin')
		.setDescription('AREDL Fishy admin command')
		.setDefaultMemberPermissions(0)
		.addSubcommand(subcommand =>
			subcommand
				.setName('migrate')
				.setDescription('Fetches all fish data from a channel and migrates it to the new database')
				.setPermission('ADMINISTRATOR')
				.addChannelOption(option =>
					option.setName('channel')
						.setDescription('The channel to fetch the data from')
						.setRequired(true)
				)
				.addStringOption(option =>
					option.setName('message_id')
						.setDescription('The message ID to start fetching from (optional)')
						.setRequired(false)
				)
		),
	async execute(interaction) {

		if (interaction.guild.id !== process.env.DISCORD_STAFF_GUILD_ID && interaction.guild.id !== process.env.DISCORD_MAIN_GUILD_ID) 
			return await interaction.reply(':x: You are not allowed to use this command.');

		const { db } = require('../index.js');
		const RateLimiter = require('bottleneck');
		const limiter = new RateLimiter({
			maxConcurrent: 1,
			minTime: 2500 
		});

		const subcommand = interaction.options.getSubcommand();
		if (subcommand === 'migrate') {
			await interaction.deferReply();

			let guild, channel;
			try {
				guild = await interaction.client.guilds.fetch(interaction.guildId);
				channel = await guild.channels.fetch(interaction.options.getChannel('channel').id);
			} catch (error) {
				logger.error(error);
				return await interaction.editReply(':x: Failed to fetch the channel. Make sure that the bot has access to it');
			}

			const startMessageId = interaction.options.getString('message_id');

			let nb_messages = 0;
			let nb_fished = 0;
			let nb_fished_error = 0;

			let message;
			if (startMessageId) {
				try {
					message = await channel.messages.fetch(startMessageId);
				} catch (error) {
					logger.error(`Failed to fetch starting message with ID: ${startMessageId}`, error);
					return await interaction.editReply(':x: Failed to fetch the starting message. Make sure the ID is correct and the bot has access to it.');
				}
			} else {
				message = await channel.messages
					.fetch({ limit: 1 })
					.then(messagePage => (messagePage.size === 1 ? messagePage.at(0) : null));
			}
			
			while (message) {
				await limiter.schedule(() => channel.messages
					.fetch({ limit: 100, before: message.id })
					.then(async messagePage => {
						for (const msg of messagePage.values()) {
							if (msg.author.bot && isFishMessage(msg.content)) {
								const extractedData = parseFishData(msg.content);
								if (extractedData) {
									const user = guild.members.cache.find(member => member.user.tag === extractedData.userTag);
									logger.info(`Extracted fish data: ${extractedData.userTag} - ${extractedData.amount} - ${extractedData.levelName} (${msg.id})`);
									if (!user) {
										logger.warn(`User not found: ${extractedData.userTag}`);
										nb_fished_error++;
										continue;
									}

									const levelfile = await db.cache.findOne({ where: { name: extractedData.levelName } });
									const existingUser = await db.users.findOne({ where: { user: user.id } });

									if (!existingUser) {
										logger.info(`Creating new user: ${user.id}`);
										await db.users.create({
											user: user.id,
											amount: extractedData.amount,
											mean: extractedData.amount,
											fished_list: JSON.stringify(levelfile ? [levelfile.filename] : []),
											fished_list_frequency: JSON.stringify(levelfile ? [1] : []),
											times_fished: 1,
										});
									} else {
										logger.info(`Updating existing user: ${user.id}`);
										const totalAmount = existingUser.amount + extractedData.amount;
										const timesFished = existingUser.times_fished + 1;
										const meanScore = totalAmount / timesFished;
										
										let fishedListData, fishedListFrequencyData;
										try {
											fishedListData = existingUser.fished_list ? JSON.parse(existingUser.fished_list) : [];
											fishedListFrequencyData = existingUser.fished_list_frequency ? JSON.parse(existingUser.fished_list_frequency) : [];
										} catch (error) {
											logger.error(error);
											nb_fished_error++;
											continue;
										}

										if (levelfile) {
											const fishedIndex = fishedListData.indexOf(levelfile.filename);
											if (fishedIndex === -1) {
												fishedListData.push(levelfile.filename);
												fishedListFrequencyData.push(1);
											} else {
												fishedListFrequencyData[fishedIndex] += 1;
											}
										} else {
											logger.warn(`Level not found: ${extractedData.level}`);
										}

										const fishedList = JSON.stringify(fishedListData);
										const fishedListFrequency = JSON.stringify(fishedListFrequencyData);
										
										await db.users.update({
											amount: totalAmount,
											mean: meanScore,
											fished_list: fishedList,
											fished_list_frequency: fishedListFrequency,
											times_fished: timesFished,
										}, { where: { user: user.id } });
									}

									nb_fished++;
								} else {
									logger.warn(`Failed to parse fish data from message: ${msg.content}`);
									nb_fished_error++;
								}
							}
						}

						message = 0 < messagePage.size ? messagePage.at(messagePage.size - 1) : null;
						nb_messages += messagePage.size;
						await interaction.editReply(`... Fetching ${nb_messages} messages from <#${channel.id}>. Fish data found: ${nb_fished} (errors: ${nb_fished_error})`);
					}));
			}
			
			return await interaction.editReply(`:white_check_mark: Successfully migrated ${nb_fished} fish data.`);
		}
	},
};

function isFishMessage(content) {
	return content.includes('fished') && content.includes('TOP');
}

function parseFishData(content) {
	try {
		const userMatch = content.match(/>\s\*\*(.*?)\*\*/);
		const pointsMatch = content.match(/\+\d+(\.\d+)? points/);
		const levelMatch = content.match(/fished \*\*(.*?)\*\*/);

		if (userMatch && pointsMatch && levelMatch) {
			return {
				userTag: userMatch[1],
				amount: parseFloat(pointsMatch[0].replace('+', '').replace(' points', '')),
				levelName: levelMatch[1],
			};
		}
	} catch (error) {
		logger.error('Failed to parse fish data from message:', error);
	}
	return null;
}
