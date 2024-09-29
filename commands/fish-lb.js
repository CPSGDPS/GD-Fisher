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

		let leaderboard;
		try {
			leaderboard = await db.users.findAll({
				order: [['amount', 'DESC']],
			});
		} catch (error) {
			logger.error('Error fetching leaderboard:', error);
			return await interaction.reply(':x: An error occurred while fetching the leaderboard');
		}

		if (!leaderboard || leaderboard.length === 0) {
			return await interaction.reply(':x: No leaderboard data available');
		}

		const data = [];
		const usersToFetch = [];

		for (const user of leaderboard) {
			if (!interaction.client.users.cache.has(user.user)) {
				usersToFetch.push(user.user);
			}
		}

		if (usersToFetch.length > 0) {
			try {
				logger.log(`Fetching ${usersToFetch.length} users...`);
				await interaction.client.users.fetch({ user: usersToFetch });
			} catch (error) {
				logger.warn('Some users could not be fetched:', error);
			}
		}

		try {
			for (let i = 0; i < leaderboard.length; i++) {
				const user = leaderboard[i];
				const discordUser = interaction.client.users.cache.get(user.user);
				data.push(`**${i+1}** - \`${discordUser?.tag ?? user.user}\` (${Math.round(user.amount * 100) / 100} points)`);
			}
		}
		catch (error) {
			logger.error('Error fetching leaderboard:', error);
			return await interaction.reply(':x: An error occurred while fetching the leaderboard');
		}
		
		let currentPage = 1;
		const pageSize = 20;
		const userData = await db.users.findOne({ where: { user: interaction.user.id } });
		if (userData) {
			const rank = leaderboard.findIndex(user => user.user === interaction.user.id);
			if (rank !== -1) {
				currentPage = Math.floor(rank / pageSize) + 1;
			}
		}

		const pagination = new Pagination(interaction, {
			limit: pageSize,
		});
		pagination.setTitle('AREDL Fish Leaderboard');
		pagination.setDescriptions(data);
		pagination.currentPage = currentPage;
		pagination.render();
		return;
	},
};
