const {
    SlashCommandBuilder,
    AttachmentBuilder,
    StringSelectMenuBuilder,
    ActionRowBuilder,
    ComponentType,
    ButtonStyle,
    ButtonBuilder,
    EmbedBuilder,
} = require('discord.js');
const fs = require('node:fs');
const { Sequelize } = require('sequelize');
const logger = require('log4js').getLogger();
const lists = require('../others/lists.js');
const { getList } = require('../others/utils.js');
const { ButtonPaginationBuilder } = require('@thenorthsolution/djs-pagination');

module.exports = {
    enabled: true,
    cooldown: 10,
    data: new SlashCommandBuilder()
        .setName('fish-profile')
        .setDescription('Displays the list fish profile of yourself or a specific user')
        .addUserOption((option) =>
            option
				.setName('target')
				.setDescription('The user whose profile you want to see')
				.setRequired(false)
        )
        .addStringOption((option) =>
            option
				.setName('list')
				.setDescription('The list to show your profile from (your default list can be set with /settings)')
				.setRequired(false)
				.addChoices(lists.map((list) => ({
					name: `${list.name} (${list.fullname})`,
					value: list.value
           		})))
        ),
    async execute(interaction) {
        const { db, cache } = require('../index.js');
        let response = await interaction.reply({
            content: 'Loading profile...'
        });

        let list = await getList(interaction);
        let sorting = 'rank';

        const targetUser = interaction.options.getUser('target') || interaction.user;
        const targetId = targetUser.id;
        const targetTag = targetUser.tag;

        let pagination;
        const pageSize = 10;

		const levelsCache = {};
		await Promise.all(
			lists.map(async (list) => {
				try {
					const levels = await cache[list.value].findAll({
						attributes: ['position', 'name', 'filename']
					});
					levelsCache[list.value] = new Map(levels.map((level) => [level.filename, level]));
				} catch (error) {
					logger.error(`Could not fetch levels for list ${list.value}: ${error}`);
				}
			})
		);
  
        async function buildPaginationData(userdata, list) {
            const rank = (await db[list].count({
                where: {
                    amount: {
                        [Sequelize.Op.gt]: userdata.amount
                    }
                }
            })) + 1;
            const totalAmount = Math.round(userdata.amount * 100) / 100;
            const meanScore = Math.round(userdata.mean * 100) / 100;
            const timesFished = userdata.times_fished;

            const mainData = `## ${targetTag}'s fish profile\n### List: ${lists.find((l) => l.value == list)?.name}\n- Global Rank: **#${rank}**\n- Total Points: **${totalAmount}**\n- Points on average: **${meanScore}**\n- Times Fished: **${timesFished}**\n### Fished Levels:`;

            const fishedListData = userdata.fished_list ? JSON.parse(userdata.fished_list) : [];
            const fishedListFrequency = userdata.fished_list_frequency ? JSON.parse(userdata.fished_list_frequency) : [];

            const fishedList = fishedListData
                .map((level, index) => {
                    const levelData = levelsCache[list].get(level);
                    if (!levelData) return null;
                    const frequency = fishedListFrequency[index] || 0;
                    return {
                        position: levelData.position,
                        frequency,
                        display: `**#${levelData.position}** - ${levelData.name} ${frequency > 1 ? `**(x${frequency})**` : ''}`,
                    };
                })
                .filter(Boolean)
                
			const rankSortedList = fishedList.sort((a, b) => a.position - b.position )
				.map((item) => item.display);
			const timesSortedList = fishedList.sort((a, b) => b.frequency - a.frequency)
				.map((item) => item.display);

            const chunks = {
				rank: [],
				times: []
			};
            for (let i = 0; i < rankSortedList.length; i += pageSize) {
                chunks['rank'].push(rankSortedList.slice(i, i + pageSize));
				chunks['times'].push(timesSortedList.slice(i, i + pageSize));
            }

            return { mainData, chunks };
        }

        const userDataList = {};
        await Promise.all(
            lists.map(async (l) => {
                try {
                    const user = await db[l.value].findOne({
                        where: {
                            user: targetId
                        }
                    });
                    const data = user ? await buildPaginationData(user, l.value) : null;
                    userDataList[l.value] = data;
                } catch (error) {
                    logger.error(`Could not fetch user data for list ${l.value}: ${error}`);
                }
            })
        );

        const attachments = {};
        lists.forEach((list) => {
            const logoPath = `assets/list-icons/${list.value}.webp`;
            if (fs.existsSync(logoPath)) {
                try {
                    attachments[list.value] = new AttachmentBuilder(logoPath, {
                        name: 'listlogo.webp'
                    });
                } catch (error) {
                    logger.error(`Could not attach file: ${error}`);
                }
            }
        });

        async function updatePagination(newInteraction) {
            const userData = userDataList[list];
            if (!(userData?.chunks[sorting])) {
                return await newInteraction.editReply(`> :x: **${targetTag}** does not have any fishing data on **${lists.find((l) => l.value == list)?.name}**.`);
            }

            const attachment = attachments[list];

            pagination?._collector?.stop();
            pagination = new ButtonPaginationBuilder();
            pagination
                .addButton(new ButtonBuilder().setEmoji('⏮️').setCustomId('first').setStyle(ButtonStyle.Secondary), 'FirstPage')
                .addButton(new ButtonBuilder().setEmoji('◀️').setCustomId('prev').setStyle(ButtonStyle.Secondary), 'PreviousPage')
                .addButton(new ButtonBuilder().setEmoji('▶️').setCustomId('next').setStyle(ButtonStyle.Secondary), 'NextPage')
                .addButton(new ButtonBuilder().setEmoji('⏭️').setCustomId('last').setStyle(ButtonStyle.Secondary), 'LastPage')
                .setAuthorDependent(true);

            const selectLeaderboard = new StringSelectMenuBuilder()
                .setCustomId('select-leaderboard')
                .addOptions(lists.map((l) => ({
                    label: `${l.name} (${l.fullname})`,
                    value: l.value
                })))
                .setPlaceholder(`List: ${lists.find((l) => l.value === list).name}`);

            const selectSorting = new StringSelectMenuBuilder()
                .setCustomId('select-sorting')
                .addOptions({
                    label: 'Rank',
                    value: 'rank'
                }, {
                    label: 'Times fished',
                    value: 'times'
                })
                .setPlaceholder(`Sort by: ${sorting === 'rank' ? 'Rank' : 'Times fished'}`);

            pagination.addAdditionalActionRows([new ActionRowBuilder().addComponents(selectLeaderboard), new ActionRowBuilder().addComponents(selectSorting)]);
            pagination.on('error', (error) => logger.error(`Pagination error: ${error}`));

            userData.chunks[sorting].forEach((chunk, index) => {
                const embedDescription = userData.mainData + '\n' + chunk.join('\n');
                const embed = new EmbedBuilder()
                    .setDescription(embedDescription)
                    .setColor('DarkBlue')
                    .setFooter({
                        text: `Page ${index + 1} of ${userData.chunks[sorting].length}`
                    });

                if (attachment) embed.setThumbnail(`attachment://${attachment.name}`);
                pagination.addPages(embed);
            });


            await pagination.send({
                command: interaction,
                sendAs: 'EditMessage'
            });
            await interaction.editReply({
                files: attachment ? [attachment] : [],
                content: ''
            });
        }

        await updatePagination(interaction);

        const listCollectorFilter = (i) => i.user.id === interaction.user.id && i.customId === 'select-leaderboard';
        const sortCollectorFilter = (i) => i.user.id === interaction.user.id && i.customId === 'select-sorting';

        const listCollector = response.createMessageComponentCollector({
            filter: listCollectorFilter,
            componentType: ComponentType.StringSelect,
            time: 300_000,
        });

        const sortCollector = response.createMessageComponentCollector({
            filter: sortCollectorFilter,
            componentType: ComponentType.StringSelect,
            time: 300_000,
        });

        listCollector.on('collect', async (selectMenuInteraction) => {
            await selectMenuInteraction.update({ content: ''  });
            const new_list = selectMenuInteraction.values[0];
            if (new_list !== list) {
                list = new_list;
                await updatePagination(selectMenuInteraction);
            }
        });

        sortCollector.on('collect', async (selectMenuInteraction) => {
            await selectMenuInteraction.update({ content: '' });
            const new_sorting = selectMenuInteraction.values[0];
            if (new_sorting !== sorting) {
                sorting = new_sorting;
                await updatePagination(selectMenuInteraction);
            }
        });

        listCollector.on('end', async (_, reason) => {
            if (reason === 'time') {
                await interaction.editReply({
                    components: []
                });
            }
        });
    },
};