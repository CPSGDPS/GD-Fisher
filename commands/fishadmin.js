const { SlashCommandBuilder } = require('discord.js');
const logger = require('log4js').getLogger();
const lists = require('../others/lists.js');

module.exports = {
	enabled: true,
	cooldown: 5,
	data: new SlashCommandBuilder()
		.setName('fishadmin')
		.setDescription('GD Lists Fishy admin command')
		.setContexts(['Guild'])
		.setDefaultMemberPermissions(0)
		.addSubcommand(subcommand =>
			subcommand
				.setName('setguilddefault')
				.setDescription('Sets the default list for users in this server')
				.addStringOption(option =>
					option.setName('list')
						.setDescription('The list to set as default')
						.addChoices(lists.map(list => { return {name:list.name, value: list.value}}))
						.setRequired(true)
				)
		),
	async execute(interaction) {
		const { db } = require('../index.js');
		const subcommand = interaction.options.getSubcommand();
		if (subcommand === 'setguilddefault') {
			const list = interaction.options.getString('list');
			try {
				if (await db.guild_settings.findOne({ where: { guild: interaction.guild.id } })) {
					await db.guild_settings.update({ default_list: list }, { where: { guild: interaction.guild.id } });
				} else {
					await db.guild_settings.create({ guild: interaction.guild.id, default_list: list });
				}
			} catch (error) {
				logger.error('Error setting guild default:', error);
				return await interaction.reply(':x: An error occurred while setting the guild default list');
			}
				return await interaction.reply({ content:`:white_check_mark: The default list for this server was set to \`${lists.find((l) => l.value == list)?.name}\` successfully.`, ephemeral: true });
			}
	},
};