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

		let guildMembers;
		try {
			guildMembers = await interaction.guild.members.fetch({cache: true});
		} catch (error) {
			logger.error('Error fetching guild members:', error);
			return await interaction.reply(':x: An error occurred while fetching guild members.');
		}

		const guildMemberIds = new Set(guildMembers.map(member => member.user.id));
		const filteredLeaderboard = leaderboard.filter(user => guildMemberIds.has(user.user));

		if (filteredLeaderboard.length === 0) {
			return await interaction.reply(':x: No leaderboard data available for members of this guild');
		}

		const data = [];
		for (let i = 0; i < filteredLeaderboard.length; i++) {
			const user = filteredLeaderboard[i];
			const discordUser = interaction.client.users.cache.get(user.user);
			data.push(`**${i + 1}** - \`${discordUser?.tag ?? user.user}\` (${Math.round(user.amount * 100) / 100} points)`);
		}

		let currentPage = 1;
		const pageSize = 20;
		const userData = await db.users.findOne({ where: { user: interaction.user.id } });
		if (userData) {
			const rank = filteredLeaderboard.findIndex(user => user.user === interaction.user.id);
			if (rank !== -1) {
				currentPage = Math.floor(rank / pageSize) + 1;
			}
		}

		// Set up pagination
		const pagination = new Pagination(interaction, {
			limit: pageSize,
		});
		pagination.setTitle('AREDL Fish Leaderboard');
		pagination.setPrevDescription(`Server: ${interaction.guild.name}`);
		pagination.setDescriptions(data);
		pagination.currentPage = currentPage;
		pagination.render();
	},
};
