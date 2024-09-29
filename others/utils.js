module.exports = {
	async getList(interaction) {
		const { db } = require('../index.js');
	 	return interaction.options.getString('list') 
			?? await db.user_settings.findOne({ where: { user: interaction.user.id } }).then(data => data?.default_list)
			?? await db.guild_settings.findOne({ where: { guild: interaction.guild.id } }).then(data => data?.default_list) 
			?? 'aredl';
		}
}