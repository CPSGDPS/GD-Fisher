const { SlashCommandBuilder } = require('discord.js');
const lists = require('../others/lists.js');

module.exports = {
	enabled: true,
	data: new SlashCommandBuilder()
		.setName('placement')
		.setDescription('Look up the placement for any level on a list.')
		.addStringOption(option =>
			option.setName('list')
				.setDescription('The list on which you want to look up the placement for the level.')
				.setRequired(true)
				.addChoices(lists.map(list => { return {name:`${list.name} (${list.fullname})`, value: list.value}}))
		)
        .addStringOption(option =>
            option.setName('level')
                .setDescription('The level you\'re looking up the placement for (Be sure to select one of the available options.)')
                .setMaxLength(1024)
                .setRequired(true)
                .setAutocomplete(true)),
    async autocomplete(interaction) {
        const { cache } = require('../index.js');
		const focusedValue = interaction.options.getFocused();
		const list = interaction.options.getString('list');
		if (!list) return await interaction.respond([]);
		
		const Sequelize = require('sequelize');
		let levels = await cache[list].findAll({
			where: { 
				name: Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('name')), 'LIKE', '%' + focusedValue.toLowerCase() + '%')
			}});
		await interaction.respond(
			levels.slice(0,25).map(level => ({ name:level.name, value: level.filename })),
		);
	

	},
	async execute(interaction) {
        const { cache } = require('../index.js');
		const list = interaction.options.getString('list');
        const level = await cache[list].findOne({where: {filename: [interaction.options.getString('level')]}});

		if (!level || level?.position == null) return await interaction.reply(`:x: **${interaction.options.getString('level')}** is not on this list. Make sure to select the right option`);
		await interaction.reply(`**${level.name}** is placed at **#${level.position}** on the **${lists.find(l => l.value == list).name}**.`);
	},
};