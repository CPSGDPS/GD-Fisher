const fs = require('node:fs');
const path = require('node:path');
const { Collection } = require('discord.js');
const cron = require('node-cron');
const log4js = require('log4js');
const logger = log4js.getLogger();

module.exports = {
	async clientInit(client) {
		logger.info('Initializing client...');
		// Commands
		client.commands = new Collection();
		client.cooldowns = new Collection();
		logger.info('  Loading commands');
		const commandsPath = path.join(__dirname, '../commands');

		if (fs.existsSync(commandsPath)) {
			const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
			for (const file of commandFiles) {
				const filePath = path.join(commandsPath, file);
				const command = require(filePath);
				if ('data' in command && 'execute' in command && 'enabled' in command) {
					if (command.enabled) {
						client.commands.set(command.data.name, command);
						logger.info(`    Loaded ${command.data.name} from ${filePath}`);
					} else {
						logger.info(`    Ignored disabled command ${filePath}`);
					}
				} else {
					logger.warn(`    The command at ${filePath} is missing a required "data", "execute" or "enabled" property.`);
				}
			}
		}

		// Buttons
		logger.info('  Loading buttons');
		client.buttons = new Collection();
		const buttonsPath = path.join(__dirname, '../buttons');

		if (fs.existsSync(buttonsPath)) {
			const buttonsFiles = fs.readdirSync(buttonsPath).filter(file => file.endsWith('.js'));
			for (const file of buttonsFiles) {
				const filePath = path.join(buttonsPath, file);
				const button = require(filePath);
				client.buttons.set(button.customId, button);
				logger.info(`    Loaded ${button.customId} from ${filePath}`);
			}
		}

		// Events
		logger.info('  Loading events');
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
				logger.info(`    Loaded ${event.name} from ${filePath}`);
			}
		}

		logger.info('Client initialization done');
	},

	// Sequelize sync init
	async sequelizeInit(db) {
		logger.info('Syncing database data...');
		for (const table of Object.keys(db)) await db[table].sync({ alter: true});
		logger.info('Database sync done');
	},

	// Scheduled cron tasks
	async scheduledTasksInit() {
		
		logger.info('Setting up scheduled tasks');
		const scheduledPath = path.join(__dirname, '../scheduled');
		if (fs.existsSync(scheduledPath)) {
			const scheduledFiles = fs.readdirSync(scheduledPath).filter(file => file.endsWith('.js'));

			for (const file of scheduledFiles) {
				const filePath = path.join(scheduledPath, file);
				const task = require(filePath);

				if ("name" in task && "cron" in task && "enabled" in task && "execute" in task) {
					if (task.enabled) {
						cron.schedule(task.cron, task.execute);
						logger.info(`  Started ${task.name}(${task.cron}) from ${filePath}`);
					} else {
						logger.info(`  Ignored disabled ${task.name}(${task.cron}) from ${filePath}`);
					}
				} else {
					logger.warn(`  The task at ${filePath} is missing a required "name", "cron", "enabled" or "execute" property.`);
				}
			}
		}
		logger.info('Scheduled tasks setup done');
	}
}