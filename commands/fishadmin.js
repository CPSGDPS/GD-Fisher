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
				.addChannelOption(option =>
					option.setName('channel')
						.setDescription('The channel to fetch the data from')
						.setRequired(true)
				)
				.addStringOption(option =>
					option.setName('start_message_id')
						.setDescription('The message ID to start fetching from (optional)')
						.setRequired(false)
				)
				.addStringOption(option =>
					option.setName('end_message_id')
						.setDescription('The message ID to stop fetching at (optional)')
						.setRequired(false)
				)
		).addSubcommand(subcommand =>
			subcommand
				.setName('setid')
				.setDescription('Sets a new ID for a tag')
				.addStringOption(option =>
					option.setName('tag')
						.setDescription('The tag to update')
						.setRequired(true)
				)
				.addStringOption(option =>
					option.setName('id')
						.setDescription('The new ID to set')
						.setRequired(true)
				)
		),
	async execute(interaction) {

		if (interaction.guild.id !== process.env.DISCORD_STAFF_GUILD_ID && interaction.guild.id !== process.env.DISCORD_MAIN_GUILD_ID) 
			return await interaction.reply(':x: You are not allowed to use this command.');

		const { db } = require('../index.js');
		const RateLimiter = require('bottleneck');
		const limiter = new RateLimiter({
			maxConcurrent: 1,
			minTime: 1000 
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

			const startMessageId = interaction.options.getString('start_message_id');
			const endMessageId = interaction.options.getString('end_message_id');

			const startMessageLink = startMessageId
			? `https://discord.com/channels/${interaction.guild.id}/${channel.id}/${startMessageId}`
			: 'Latest Message';

			const endMessageLink = endMessageId
			? `https://discord.com/channels/${interaction.guild.id}/${channel.id}/${endMessageId}`
			: 'Oldest Message';

			let nb_messages = 0;
			let nb_fished = 0;
			let nb_fished_error = 0;
			let nb_ignored = 0;

			const unknownTags = new Set();

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
			let i = 0;

			while (message) {
				await limiter.schedule(() => channel.messages
					.fetch({ limit: 100, before: message.id })
					.then(async messagePage => {
						for (const msg of messagePage.values()) {
							if (endMessageId && msg.id === endMessageId) {
								logger.info(`Reached end message ID: ${endMessageId}. Stopping migration.`);
								message = null;
								break;
							}
							if (await db.processed.findOne({ where: { id: msg.id } })) {
								nb_ignored++;
								continue;
							}
							
							if (msg.author.id == process.env.DISCORD_MIGRATE_ID && isFishMessage(msg.content)) {
								const extractedData = parseFishData(msg.content);
								if (extractedData) {
									const userID = await findUserInAllGuilds(db, interaction.client, extractedData.userTag);
									logger.info(`Extracted fish data: ${extractedData.userTag} - ${extractedData.amount} - ${extractedData.levelName} (${msg.id})`);

									if (!userID) {
										logger.warn(`User not found in any known guilds: ${extractedData.userTag}`);
										unknownTags.add(extractedData.userTag);
										nb_fished_error++;
										continue;
									}
									const levelfile = await db.cache.findOne({ where: { name: extractedData.levelName } });
									const existingUser = await db.users.findOne({ where: { user: userID } });

									if (!existingUser) {
										logger.info(`Creating new user: ${userID}`);
										await db.users.create({
											user: userID,
											amount: extractedData.amount,
											mean: extractedData.amount,
											fished_list: JSON.stringify(levelfile ? [levelfile.filename] : []),
											fished_list_frequency: JSON.stringify(levelfile ? [1] : []),
											times_fished: 1,
										});
									} else {
										logger.info(`Updating existing user: ${userID}`);
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
										}, { where: { user: userID } });
									}

									await db.processed.create({
										id: msg.id,
									});

									nb_fished++;
								} else {
									logger.warn(`Failed to parse fish data from message: ${msg.content}`);
									nb_fished_error++;
								}
							} else {
								await db.processed.create({
									id: msg.id,
								});
							}
						}

						message = message != null ? (0 < messagePage.size ? messagePage.at(messagePage.size - 1) : null) : null;
						nb_messages += messagePage.size;
						if (i % 10 === 0) {
							try {
								interaction.editReply(`> ## Migrating data...\n> From: ${startMessageLink}\n> To: ${endMessageLink}\n> Fetched **${nb_messages}** messages from <#${channel.id}>\n> Fish data found: **${nb_fished}**\n> Errors: **${nb_fished_error}**\n> Ignored: **${nb_ignored}**`);
							}
							catch (error) {
								logger.error('Failed to edit reply:', error);
							}
						}
						i++;
					}));
			}

			logger.info(`Migration successful. Fetched ${nb_messages} messages from ${channel.id}. Fish data found: ${nb_fished}. Errors: ${nb_fished_error}. Ignored: ${nb_ignored}`);
			if (unknownTags.size > 0) {
				logger.warn(`Unknown tags:\n${[...unknownTags].join('\n')}`);
			}
			try {
				return await interaction.editReply(`> ## :white_check_mark: Migration successful\n> Fetched **${nb_messages}** messages from <#${channel.id}>\n> Fish data found: **${nb_fished}**\n> Errors: **${nb_fished_error}**\n> Ignored: **${nb_ignored}**\n`);
			} catch (error) {
				logger.error('Failed to edit reply:', error);
			}
		} else if (subcommand === 'setid') {
			const tag = interaction.options.getString('tag');
			const id = interaction.options.getString('id');

			try {
				await db.tags.update({ user: id }, { where: { tag: tag } });
			} catch (error) {
				logger.error('Failed to update tag:', error);
				return await interaction.reply(':x: Failed to update tag');
			}

			return await interaction.reply(`:white_check_mark: Updated tag: ${tag} to ID: ${id}`);
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


async function findUserInAllGuilds(db, client, userTag) {

	const user = await db.tags.findOne({ where: { tag: userTag } });

	if (user) {
        return user.user;
    }

    for (const [guildId, guild] of client.guilds.cache) {
        try {
            await guild.members.fetch();
            const user = guild.members.cache.find(member => member.user.tag === userTag);
            if (user) {
				await db.tags.create({
					tag: userTag,
					user: user.id,
				});
                return user.id;
            }
        } catch (error) {
            logger.warn(`Failed to fetch members for guild: ${guild.name}`, error);
        }
    }

	await db.tags.create({
		tag: userTag,
		user: null,
	})
    return null;
}
