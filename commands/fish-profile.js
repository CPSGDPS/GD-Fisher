const { SlashCommandBuilder } = require('discord.js');

const { Sequelize } = require('sequelize');
const logger = require('log4js').getLogger();

module.exports = {
	enabled: true,
	cooldown: 10,
	data: new SlashCommandBuilder()
		.setName('fish-profile')
		.setDescription('Displays the fish profile of yourself or a specific user')
		.addUserOption(option => 
			option
				.setName('target')
				.setDescription('The user whose profile you want to see')
				.setRequired(false)
		),
	async execute(interaction) {
		const { Pagination } = require('pagination.djs');
		const { db } = require('../index.js');

		const targetUser = interaction.options.getUser('target') || interaction.user;
		const targetId = targetUser.id;
		const targetTag = targetUser.tag;

		const userdata = await db.users.findOne({ where: { user: targetId } });
		if (!userdata) {
			return await interaction.reply(`> :x: **${targetTag}** does not have any fishing data.`);
		}

		const rank = await db.users.count({
			where: {
				amount: {
					[Sequelize.Op.gt]: userdata.amount,
				},
			},
		}) + 1;

		const totalAmount = Math.round(userdata.amount * 100) / 100;
		const meanScore = Math.round(userdata.mean * 100) / 100;
		const timesFished = userdata.times_fished;

		const mainData = `- Rank: **#${rank}**\n- Total Points: **${totalAmount}**\n- Points on average: **${meanScore}**\n- Times Fished: **${timesFished}**\n### Fished Levels:`;

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
				const leveldata = await db.cache.findOne({ where: { filename: level } });
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
		pagination.setTitle(`${targetTag}'s Fish Profile`)
		pagination.setDescriptions(sortedFishedList);
		pagination.setColor('DarkBlue');
		pagination.render();

		return;
	},
};
