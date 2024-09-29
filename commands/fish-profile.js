const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('node:fs');
const { Sequelize } = require('sequelize');
const logger = require('log4js').getLogger();
const lists = require('../others/lists.js');
const { getList } = require('../others/utils.js');

module.exports = {
	enabled: true,
	cooldown: 10,
	data: new SlashCommandBuilder()
		.setName('fish-profile')
		.setDescription('Displays the list fish profile of yourself or a specific user')
		.addUserOption(option => 
			option
				.setName('target')
				.setDescription('The user whose profile you want to see')
				.setRequired(false)
		)
		.addStringOption(option =>
			option
				.setName('list')
				.setDescription('The list to show your profile from (your default list can be set with /settings)')
				.setRequired(false)
				.addChoices(lists.map(list => { return {name:list.name, value: list.value}})),
		),
	async execute(interaction) {
		const { Pagination } = require('pagination.djs');
		const { db, cache } = require('../index.js');
		
		const list = await getList(interaction);

		const targetUser = interaction.options.getUser('target') || interaction.user;
		const targetId = targetUser.id;
		const targetTag = targetUser.tag;

		const userdata = await db[list].findOne({ where: { user: targetId } });
		if (!userdata) {
			return await interaction.reply(`> :x: **${targetTag}** does not have any fishing data on **${list.toUpperCase()}**.`);
		}

		const rank = await db[list].count({
			where: {
				amount: {
					[Sequelize.Op.gt]: userdata.amount,
				},
			},
		}) + 1;

		const totalAmount = Math.round(userdata.amount * 100) / 100;
		const meanScore = Math.round(userdata.mean * 100) / 100;
		const timesFished = userdata.times_fished;

		const mainData = `## ${targetTag}'s fish profile\n### List: ${list.toUpperCase()}\n- Global Rank: **#${rank}**\n- Total Points: **${totalAmount}**\n- Points on average: **${meanScore}**\n- Times Fished: **${timesFished}**\n### Fished Levels:`;

		let fishedListData, fishedListFrequency;
		try {
			fishedListData = userdata.fished_list ? JSON.parse(userdata.fished_list): [];
			fishedListFrequency = userdata.fished_list_frequency ? JSON.parse(userdata.fished_list_frequency): [];
		} catch (error) {
			logger.error(error);
			return await interaction.reply(':x: An error occurred while parsing the fished list data.');
		}

		const fishedList = await Promise.all(
			fishedListData.map(async (level, index) => {
				const leveldata = await cache[list].findOne({ where: { filename: level } });
				if (!leveldata) return null;
				const frequency = fishedListFrequency[index] || 0;
			  	return { position: leveldata.position, display: `**#${leveldata.position}** - ${leveldata.name} ${frequency > 1 ? `**(x${frequency})**` : ''}`};
			})
		  );
		  
		  const sortedFishedList = fishedList
			.filter(item => item !== null)
			.sort((a, b) => a.position - b.position)
			.map(item => item.display);

		

		const pagination = new Pagination(interaction, {limit: 10, prevDescription: mainData});
		
		const logoPath = `assets/list-icons/${list}.webp`;
		if (fs.existsSync(logoPath)) {
			try {
				const attachment = new AttachmentBuilder(logoPath, { name: 'listlogo.webp' });
				pagination.setAttachments([attachment]);
				pagination.setThumbnail(`attachment://${attachment.name}`);
			} catch (error) {
				logger.error(`Could not attach file: ${error}`);
			}
		} else {
			logger.warn(`List logo file could not be found: ${logoPath}`);
		}

		pagination.setDescriptions(sortedFishedList);
		pagination.setColor('DarkBlue');
		pagination.render();

		return;
	},
};
