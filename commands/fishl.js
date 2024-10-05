const { SlashCommandBuilder } = require('discord.js');
const lists = require('../others/lists.js');
const { fish } = require('../others/utils.js');

const listSubcommands = lists.map(list => ({
    name: list.value,
    description: `Command shortcut to fish from the ${list.name}`,
}));

module.exports = {
	enabled: true,
	cooldown: 5,
	data: (() => {
		const command = new SlashCommandBuilder()
			.setName('fishl')
			.setDescription('GD Lists Fishing');

		listSubcommands.forEach(sub => {
			command.addSubcommand(subcommand =>
				subcommand
					.setName(sub.name)
					.setDescription(sub.description)
					.addUserOption(option =>
						option.setName('for')
							.setDescription('The user you want to fish for')
							.setRequired(false))
			);
		});
		return command;
	})(),

	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();
		await fish(interaction, subcommand);
	},
};