// Imports
const simpleGit = require('simple-git');
const Sequelize = require('sequelize');
const dotenv = require('dotenv');
const { Client, GatewayIntentBits } = require('discord.js');
const log4js = require('log4js');
const { clientInit, sequelizeInit } = require('./others/startUtils');
const updateCache = require('./scheduled/updateCache');

// Logger
log4js.configure('./log4js.json');
const logger = log4js.getLogger();
const sqlLogger = log4js.getLogger('sql');

// Env variables
dotenv.config();

// Discord client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Git repo setup
const git = simpleGit();

// Database setup
const sequelize = new Sequelize({
	dialect: 'sqlite',
	logging: (msg) => sqlLogger.debug(msg),
	storage: './data/database.sqlite',
});

const db = require('./others/dbSchema').createDbSchema(sequelize);

// Initialize client
async function init() {
	await clientInit(client, db);
	await sequelizeInit(db);
	await updateCache.execute();

	logger.info('Logging in with discord...');
	client.login(process.env.DISCORD_TOKEN);
}

module.exports = { db, client, git, sequelize };

init();



