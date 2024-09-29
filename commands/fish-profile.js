const { SlashCommandBuilder, AttachmentBuilder, StringSelectMenuBuilder, ActionRowBuilder, ComponentType } = require('discord.js');
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
		const { Pagination, ExtraRowPosition } = require('pagination.djs');
		const { db, cache } = require('../index.js');
		
		const response = await interaction.reply({ content: 'Loading leaderboard...' });

		let list = await getList(interaction);
		let sorting = 'rank';

		const targetUser = interaction.options.getUser('target') || interaction.user;
		const targetId = targetUser.id;
		const targetTag = targetUser.tag;

		const pagination = new Pagination(interaction, {limit: 10});
		

		const selectLeaderboard = new StringSelectMenuBuilder()
			.setCustomId('select-leaderboard')
			.setPlaceholder('List selection')
			.addOptions(lists.map(l => ({ label: l.name, value: l.value})));

		const selectSorting = new StringSelectMenuBuilder()
			.setCustomId('select-sorting')
			.setPlaceholder('Sort by')
			.addOptions({ label: 'Rank', value: 'rank' }, { label: 'Times fished', value: 'times' });

		const listActionRow = new ActionRowBuilder().addComponents(selectLeaderboard);
		const sortingActionRow = new ActionRowBuilder().addComponents(selectSorting);

		pagination.addActionRows([listActionRow, sortingActionRow], ExtraRowPosition.Bottom);
		pagination.setContents('');
		pagination.setColor('DarkBlue');

		async function updatePagination(list, sorting, interaction) {
			const userdata = await db[list].findOne({ where: { user: targetId } });
			if (!userdata) {
				return await interaction.editReply(`> :x: **${targetTag}** does not have any fishing data on **${list.toUpperCase()}**.`);
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
				return await interaction.editReply(':x: An error occurred while parsing the fished list data.');
			}

			const fishedList = await Promise.all(
				fishedListData.map(async (level, index) => {
					const leveldata = await cache[list].findOne({ where: { filename: level } });
					if (!leveldata) return null;
					const frequency = fishedListFrequency[index] || 0;
					  return { position: leveldata.position, frequency: frequency, display: `**#${leveldata.position}** - ${leveldata.name} ${frequency > 1 ? `**(x${frequency})**` : ''}`};
				})
			  );
		
			const sortedFishedList = fishedList
				.filter(item => item !== null)
				.sort((sorting == 'rank' ? (a, b) => a.position - b.position : (a, b) => b.frequency - a.frequency))
				.map(item => item.display);

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
			pagination.setPrevDescription(mainData);
			await pagination.render();
	
		}

		await updatePagination(list, sorting, interaction);

		const listCollectorFilter = i => i.user.id === interaction.user.id && i.customId === 'select-leaderboard';
		const sortCollectorFilter = i => i.user.id === interaction.user.id && i.customId === 'select-sorting';

		const listCollector = await response.createMessageComponentCollector({ filter: listCollectorFilter, componentType: ComponentType.StringSelect,  time: 300_000 });
		const sortCollector = await response.createMessageComponentCollector({ filter: sortCollectorFilter, componentType: ComponentType.StringSelect,  time: 300_000 });

		listCollector.on('collect', async selectMenuInteraction => {
			const new_list = selectMenuInteraction.values[0];
			if (new_list === list) return;
			list = new_list;
			await updatePagination(list, sorting, selectMenuInteraction);
			await selectMenuInteraction.update({ content: ''});
		});

		sortCollector.on('collect', async selectMenuInteraction => {
			const new_sorting = selectMenuInteraction.values[0];
			if (new_sorting === sorting) return await selectMenuInteraction.update({ content: ''});
			sorting = new_sorting;
			await updatePagination(list, sorting, selectMenuInteraction);
			await selectMenuInteraction.update({ content: ''});
		});

		listCollector.on('end', async () => {
			selectLeaderboard.setDisabled(true);
			await interaction.editReply({
				components: [new ActionRowBuilder().addComponents(selectLeaderboard)],
			});
		});

		sortCollector.on('end', async () => {
			selectSorting.setDisabled(true);
			await interaction.editReply({
				components: [new ActionRowBuilder().addComponents(selectSorting)],
			});
		});

		return;
	},
};
