const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { Pagination } = require('pagination.djs');
const logger = require('log4js').getLogger();
const lists = require('../others/lists.js');
const fs = require('node:fs');
const { getList } = require('../others/utils.js');

module.exports = {
	enabled: true,
	cooldown: 5,
	data: new SlashCommandBuilder()
		.setName('fish-lb')
		.setDescription('GD Lists Fishy leaderboard')
		.setContexts(['Guild'])
		.addStringOption(option =>
			option.setName('list')
				.setDescription('The list you want to show the leaderboard of (your default list can be set with /settings)')
				.setRequired(false)
				.addChoices(lists.map(list => { return {name:list.name, value: list.value}})),
		),

	async execute(interaction) {
		const { db } = require('../index.js');

		const list = await getList(interaction);
		let leaderboard;
		try {
			leaderboard = await db[list].findAll({
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
		const userData = await db[list].findOne({ where: { user: interaction.user.id } });
		if (userData) {
			const rank = filteredLeaderboard.findIndex(user => user.user === interaction.user.id);
			if (rank !== -1) {
				currentPage = Math.floor(rank / pageSize) + 1;
			}
		}

		const pagination = new Pagination(interaction, {
			limit: pageSize,
		});

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
		pagination.setPrevDescription(`## ${list.toUpperCase()} Fish Leaderboard\nServer: **${interaction.guild.name}**\n`);
		pagination.setDescriptions(data);
		pagination.setColor('Gold');
		pagination.currentPage = currentPage;
		pagination.render();
	},
};
