const fs = require('node:fs');
const path = require('node:path');
const { Collection } = require('discord.js');
const cron = require('node-cron');
const log4js = require('log4js');
const logger = log4js.getLogger();

module.exports = {
	async clientInit(client) {
		logger.info('Startup - ' + 'Initializing client...');
		// Commands
		client.commands = new Collection();
		client.cooldowns = new Collection();
		logger.info('Startup - ' + '  Loading commands');
		const commandsPath = path.join(__dirname, '../commands');

		if (fs.existsSync(commandsPath)) {
			const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
			for (const file of commandFiles) {
				const filePath = path.join(commandsPath, file);
				const command = require(filePath);
				if ('data' in command && 'execute' in command && 'enabled' in command) {
					if (command.enabled) {
						client.commands.set(command.data.name, command);
						logger.info('Startup - ' + `    Loaded ${command.data.name} from ${filePath}`);
					} else {
						logger.info('Startup - ' + `    Ignored disabled command ${filePath}`);
					}
				} else {
					logger.warn('Startup - ' + `    The command at ${filePath} is missing a required "data", "execute" or "enabled" property.`);
				}
			}
		}

		// Buttons
		logger.info('Startup - ' + '  Loading buttons');
		client.buttons = new Collection();
		const buttonsPath = path.join(__dirname, '../buttons');

		if (fs.existsSync(buttonsPath)) {
			const buttonsFiles = fs.readdirSync(buttonsPath).filter(file => file.endsWith('.js'));
			for (const file of buttonsFiles) {
				const filePath = path.join(buttonsPath, file);
				const button = require(filePath);
				client.buttons.set(button.customId, button);
				logger.info('Startup - ' + `    Loaded ${button.customId} from ${filePath}`);
			}
		}

		// Events
		logger.info('Startup - ' + '  Loading events');
		const eventsPath = path.join(__dirname, '../events');

		if (fs.existsSync(eventsPath)) {
		const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
			for (const file of eventFiles) {
				const filePath = path.join(eventsPath, file);
				const event = require(filePath);
				if (event.once) {
					client.once(event.name, (...args) => event.execute(...args));
				} else {
					client.on(event.name, (...args) => event.execute(...args));
				}
				logger.info('Startup - ' + `    Loaded ${event.name} from ${filePath}`);
			}
		}

		logger.info('Startup - ' + 'Client initialization done');
	},

	// Sequelize sync init
	async sequelizeInit(db, cache) {
		logger.info('Startup - ' + 'Syncing database data...');
		for (const table of Object.keys(db)) await db[table].sync({ alter: true});
		logger.info('Startup - ' + 'Syncing cache data...');
		for (const table of Object.keys(cache)) await cache[table].sync({ alter: true});
		logger.info('Startup - ' + 'Sequelize sync done');
	},

	// Scheduled cron tasks
	async scheduledTasksInit() {
		
		logger.info('Startup - ' + 'Setting up scheduled tasks');
		const scheduledPath = path.join(__dirname, '../scheduled');
		if (fs.existsSync(scheduledPath)) {
			const scheduledFiles = fs.readdirSync(scheduledPath).filter(file => file.endsWith('.js'));

			for (const file of scheduledFiles) {
				const filePath = path.join(scheduledPath, file);
				const task = require(filePath);

				if ("name" in task && "cron" in task && "enabled" in task && "execute" in task) {
					if (task.enabled) {
						cron.schedule(task.cron, task.execute);
						logger.info('Startup - ' + `  Started ${task.name}(${task.cron}) from ${filePath}`);
					} else {
						logger.info('Startup - ' + `  Ignored disabled ${task.name}(${task.cron}) from ${filePath}`);
					}
				} else {
					logger.warn('Startup - ' + `  The task at ${filePath} is missing a required "name", "cron", "enabled" or "execute" property.`);
				}
			}
		}
		logger.info('Startup - ' + 'Scheduled tasks setup done');
	},

	async updateGuilds(client) {
		const { db } = require('../index.js');
		logger.info('Startup - ' + 'Updating guilds');
		for (const guild of client.guilds.cache.values()) {
			logger.info('Startup - ' + `Connected to guild: ${guild.name} (${guild.id})`);
			if (await db.guilds.findOne({ where: { guild_id: guild.id } })) {
				await db.guilds.update({ guild_name: guild.name, guild_member_count: guild.memberCount, enabled: true }, { where: { guild_id: guild.id }});
			} else {
				logger.info('Startup - ' + `Guild does not exist in database, creating`);
				await db.guilds.create({
					guild_id: guild.id,
					guild_name: guild.name,
					guild_member_count: guild.memberCount,
					enabled: true,
				});
			}
		}
		logger.info('Startup - ' + 'Guilds updated');
	}
}