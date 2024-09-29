const { Events } = require('discord.js');
const logger = require('log4js').getLogger();

module.exports = {
	name: Events.GuildUpdate,
	once: true,
	async execute(oldGuild, newGuild) {
		const { db } = require('../index.js');
		logger.info(`Guild updated: ${newGuild.name} (${newGuild.id})`);
		try {
			const guildExists = await db.guilds.findOne({ where: { guild_id: oldGuild.id } });
			if (guildExists) {
				logger.info(`Guild already exists in database, updating`);
				await db.guilds.update({ guild_name: newGuild.name, guild_member_count: newGuild.memberCount, enabled: true }, { where: { guild_id: oldGuild.id } });
			} else {
				logger.info(`Guild does not exist in database, adding`);
				await db.guilds.create({
					guild_id: newGuild.id,
					guild_name: newGuild.name,
					guild_member_count: newGuild.memberCount,
					enabled: true,
				});
			}
		} catch (error) {
			logger.error(`Sequelize error: ${error}`);
		}
		return;
	},
};
