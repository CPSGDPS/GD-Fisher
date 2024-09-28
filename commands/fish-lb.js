const { SlashCommandBuilder } = require('discord.js');
const { Pagination } = require('pagination.djs');
const logger = require('log4js').getLogger();

module.exports = {
	enabled: true,
	cooldown: 5,
	data: new SlashCommandBuilder()
		.setName('fish-lb')
		.setDescription('AREDL Fishy leaderboard'),
	async execute(interaction) {
		const { db } = require('../index.js');

		const leaderboard = await db.users.findAll({
			order: [['amount', 'DESC']],
		});

		if (!leaderboard || leaderboard.length === 0) {
			return await interaction.reply(':x: No leaderboard data available');
		}

		const pages = [];
		const pageSize = 20;
		let i = 1;

		// Building pages
		for (let page = 0; page < Math.ceil(leaderboard.length / pageSize); page++) {
			let lbStr = `### AREDL Fish Leaderboard`;
			for (let j = 0; j < pageSize && i <= leaderboard.length; j++) {
				const user = leaderboard[i - 1];
				const discordUser = await interaction.client.users.fetch(user.user);
				lbStr += `\n**${i}** - \`${discordUser?.tag ?? user.user}\` (${Math.round(user.amount * 100) / 100} points)`;
				i++;
			}
			pages.push(lbStr);
		}

		// Select default to the page where the user is
		let currentPage = 0;
		const userData = await db.users.findOne({ where: { user: interaction.user.id } });
		if (userData) {
			const rank = leaderboard.findIndex(user => user.user === interaction.user.id);
			if (rank !== -1) {
				currentPage = Math.floor(rank / pageSize);
			}
		}

		const pagination = new Pagination(interaction);
		pagination.setDescriptions(pages);
		pagination.currentPage = currentPage;
		pagination.render();
		return;
	},
};
