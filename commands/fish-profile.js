const { SlashCommandBuilder, AttachmentBuilder, StringSelectMenuBuilder, ActionRowBuilder, ComponentType } = require('discord.js');
const fs = require('node:fs');
const { Sequelize } = require('sequelize');
const logger = require('log4js').getLogger();
const lists = require('../others/lists.js');
const { getList } = require('../others/utils.js');
const { ButtonPaginationBuilder } = require('@falloutstudios/djs-pagination');
const { ButtonBuilder, Client, EmbedBuilder } = require('discord.js');

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
		
		const { db, cache } = require('../index.js');
		
		let response = await interaction.reply({ content: 'Loading profile...' });

		let pagination;
		const pageSize = 10;

		let list = await getList(interaction);
		let sorting = 'rank';

		const targetUser = interaction.options.getUser('target') || interaction.user;
		const targetId = targetUser.id;
		const targetTag = targetUser.tag;

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

		
		async function updatePagination(newInteraction) {

			if (pagination?._collector) {
				pagination._collector.stop();
				pagination._collector = null;
			}

			interaction.editReply({ components: []})
			const userdata = await db[list].findOne({ where: { user: targetId } });
			if (!userdata) {
				return await newInteraction.editReply(`> :x: **${targetTag}** does not have any fishing data on **${list.toUpperCase()}**.`);
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
				return await newInteraction.editReply(':x: An error occurred while parsing the fished list data.');
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

			const chunks = [];
				for (let i = 0; i < sortedFishedList.length; i += pageSize) {
					chunks.push(sortedFishedList.slice(i, i + pageSize));
				}

			pagination = new ButtonPaginationBuilder()
			
			const logoPath = `assets/list-icons/${list}.webp`;
			let attachment;
			if (fs.existsSync(logoPath)) {
				try {
					attachment = new AttachmentBuilder(logoPath, { name: 'listlogo.webp' });
				} catch (error) {
					logger.error(`Could not attach file: ${error}`);
				}
			} else {
				logger.warn(`List logo file could not be found: ${logoPath}`);
			}

			chunks.forEach((chunk, index) => {
				const embedDescription = mainData + '\n' + chunk.join('\n');
				const embed = new EmbedBuilder()
					.setDescription(embedDescription)
					.setColor('DarkBlue')
					.setFooter({ text: `Page ${index + 1} of ${chunks.length}` });
		
				if (attachment) embed.setThumbnail(`attachment://${attachment.name}`);
				pagination.addPages(embed);
			});

            pagination
				.addButton(new ButtonBuilder().setLabel('First').setCustomId('first').setStyle('Primary'), 'FirstPage')
				.addButton(new ButtonBuilder().setLabel('Previous').setCustomId('prev').setStyle('Primary'), 'PreviousPage')
				.addButton(new ButtonBuilder().setLabel('Next').setCustomId('next').setStyle('Primary'), 'NextPage')
				.addButton(new ButtonBuilder().setLabel('Last').setCustomId('last').setStyle('Primary'), 'LastPage')
				.setAuthorDependent(true);

			pagination.addAdditionalActionRows([listActionRow, sortingActionRow]);
			pagination.on('error', (error) => logger.error(`Pagination error: ${error}`));

			
			await pagination.send({ command: interaction, sendAs: 'EditMessage' });
			await interaction.editReply({ files: attachment ? [attachment] : [], content: '', components: pagination.actionRows });
		}

		await updatePagination(interaction);

		const listCollectorFilter = i => i.user.id === interaction.user.id && i.customId === 'select-leaderboard';
		const sortCollectorFilter = i => i.user.id === interaction.user.id && i.customId === 'select-sorting';

		const listCollector = await response.createMessageComponentCollector({ filter: listCollectorFilter, componentType: ComponentType.StringSelect,  time: 300_000 });
		const sortCollector = await response.createMessageComponentCollector({ filter: sortCollectorFilter, componentType: ComponentType.StringSelect,  time: 300_000 });

		listCollector.on('collect', async selectMenuInteraction => {
			selectMenuInteraction.update({ content: '' });
			const new_list = selectMenuInteraction.values[0];
			if (new_list === list) return;
			list = new_list;
			await updatePagination(selectMenuInteraction);
		});

		sortCollector.on('collect', async selectMenuInteraction => {
			selectMenuInteraction.update({ content: ''});
			const new_sorting = selectMenuInteraction.values[0];
			if (new_sorting === sorting) return 
			sorting = new_sorting;
			await updatePagination(selectMenuInteraction);
			
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
