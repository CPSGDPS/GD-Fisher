const { SlashCommandBuilder, AttachmentBuilder, ComponentType, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const { Pagination, ExtraRowPosition } = require('pagination.djs');
const logger = require('log4js').getLogger();
const lists = require('../others/lists.js');
const fs = require('node:fs');
const { getList } = require('../others/utils.js');
const pageSize = 20;

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

		let list = await getList(interaction);

		const response = await interaction.reply({ content: 'Loading leaderboard...' });
		
		let guildMembers;
		try {
			guildMembers = await interaction.guild.members.fetch({cache: true});
		} catch (error) {
			logger.error('Error fetching guild members:', error);
			return await interaction.editReply(':x: An error occurred while fetching guild members.');
		}

		const guildMemberIds = new Set(guildMembers.map(member => member.user.id));

		const pagination = new Pagination(interaction, {
			limit: pageSize,
		});

		const selectLeaderboard = new StringSelectMenuBuilder()
			.setCustomId('select-leaderboard')
			.setPlaceholder('List selection')
			.addOptions(lists.map(l => ({ label: l.name, value: l.value})));

		const listActionRow = new ActionRowBuilder().addComponents(selectLeaderboard);

		pagination.addActionRows([listActionRow], ExtraRowPosition.Bottom);
		pagination.setColor('Gold');
		pagination.setContents('');

		async function updatePagination(list, interaction) {
			const leaderboard = await fetchLeaderboard(list, db);

			if (!leaderboard) {
				return await interaction.editReply(':x: An error occurred while fetching the leaderboard');
			}

			if (leaderboard.length === 0) {
				return await interaction.editReply(':x: No leaderboard data available');
			}
			
			const filteredLeaderboard = leaderboard.filter(user => guildMemberIds.has(user.user));

			if (filteredLeaderboard.length === 0) {
				return await interaction.editReply(':x: No leaderboard data available for members of this guild');
			}

			const { data, currentPage } = await formatData(filteredLeaderboard, interaction, list, db);

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
			pagination.currentPage = currentPage;
			await pagination.render();
		}

		await updatePagination(list, interaction);
		
		const listCollectorFilter = i => i.user.id === interaction.user.id && i.customId === 'select-leaderboard';
		const listCollector = await response.createMessageComponentCollector({ filter: listCollectorFilter, componentType: ComponentType.StringSelect,  time: 300_000 });

		listCollector.on('collect', async selectMenuInteraction => {
			const new_list = selectMenuInteraction.values[0];
			if (new_list === list) return await selectMenuInteraction.update({ content: ''});
			list = new_list;
			await updatePagination(list, selectMenuInteraction);
			await selectMenuInteraction.update({ content: ''});
		});

		listCollector.on('end', async () => {
			selectLeaderboard.setDisabled(true);
			await interaction.editReply({
				components: [new ActionRowBuilder().addComponents(selectLeaderboard)],
			});
		});
	},
};

async function fetchLeaderboard(list, db) {
	let leaderboard;
	try {
		leaderboard = await db[list].findAll({
			order: [['amount', 'DESC']],
		});
	} catch (error) {
		logger.error('Error fetching leaderboard:', error);
		return null;
		
	}

	return leaderboard;
}

async function formatData(leaderboard, interaction, list, db) {
	const data = [];
		for (let i = 0; i < leaderboard.length; i++) {
			const user = leaderboard[i];
			const discordUser = interaction.client.users.cache.get(user.user);
			data.push(`**${i + 1}** - \`${discordUser?.tag ?? user.user}\` (${Math.round(user.amount * 100) / 100} points)`);
		}

		let currentPage = 1;
		const userData = await db[list].findOne({ where: { user: interaction.user.id } });
		if (userData) {
			const rank = leaderboard.findIndex(user => user.user === interaction.user.id);
			if (rank !== -1) {
				currentPage = Math.floor(rank / pageSize) + 1;
			}
		}

		return { data:data, currentPage: currentPage };
}