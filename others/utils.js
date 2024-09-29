module.exports = {
	async getList(interaction) {
		const { db } = require('../index.js');
	 	return interaction.options.getString('list') 
			?? (interaction.user ? await db.user_settings.findOne({ where: { user: interaction?.user?.id } }).then(data => data?.default_list) : null)
			?? (interaction.guild ? await db.guild_settings.findOne({ where: { guild: interaction?.guild?.id } }).then(data => data?.default_list) : null) 
			?? 'aredl';
		}
}