const { Events } = require('discord.js');
const logger = require('log4js').getLogger();

module.exports = {
	name: Events.GuildDelete,
	once: true,
	async execute(guild) {
		const { db } = require('../index.js');
		logger.info(`Left guild: ${guild.name} (${guild.id})`);
		try {
			const guildExists = await db.guilds.findOne({ where: { guild_id: guild.id } });
			if (guildExists) {
				logger.info(`Guild already exists in database, updating`);
				await db.guilds.update({ guild_name: guild.name, enabled: false }, { where: { guild_id: guild.id } });
			} else {
				logger.info(`Guild does not exist in database, adding`);
				await db.guilds.create({
					guild_id: guild.id,
					guild_name: guild.name,
					enabled: false,
				});
			}
		} catch (error) {
			logger.error(`Sequelize error: ${error}`);
		}
		return;
	},
};
