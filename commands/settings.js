const { SlashCommandBuilder } = require('discord.js');
const logger = require('log4js').getLogger();
const lists = require('../others/lists.js');

module.exports = {
	enabled: true,
	cooldown: 5,
	data: new SlashCommandBuilder()
		.setName('settings')
		.setDescription('Set your default list')
		.addStringOption(option =>
			option.setName('defaultlist')
				.setDescription('The list you want to fish from by default, without having to specify it on each command')
				.setRequired(true)
				.addChoices(lists.map(list => { return {name:`${list.name} (${list.fullname})`, value: list.value}}))),
	async execute(interaction) {
		const { db } = require('../index.js');
		const id = interaction.user.id;
		const list = interaction.options.getString('defaultlist');

		try {
			if (await db.user_settings.findOne({ where: { user: id } })) {
				await db.user_settings.update({ default_list: list }, { where: { user: id } });
			} else {
				await db.user_settings.create({ user: id, default_list: list });
			}
		} catch (error) {
			logger.error('Error setting default list:', error);
			return await interaction.reply(':x: An error occurred while setting your default list');
		}
		
		return await interaction.reply({ content:`:white_check_mark: Your default list was set to \`${lists.find((l) => l.value == list)?.name}\` successfully.`, ephemeral: true });
	},
};
