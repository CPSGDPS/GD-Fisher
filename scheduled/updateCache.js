const { cloneOrPullRepo, parseLevels } = require('../others/gitUtils.js');
const logger = require('log4js').getLogger();

const lists = require('../others/lists.js');

module.exports = {
	name: 'updateCache',
	cron: '30 * * * *',
	enabled: true,
	async execute() {
		const { cache } = require('../index.js');

		logger.info('Updating cached levels...');
		for (const list of lists.map(l => l.value)) {
			logger.info(`Updating ${list} list...`);
			await cloneOrPullRepo(list);
			logger.info('Parsing levels...');
			const levels = await parseLevels(list);
		
			await cache[list].destroy({ where: {}});
			try {
				await cache[list].bulkCreate(levels);
				logger.info(`Successfully updated ${levels.length} cached levels.`);
			} catch (error) {
				logger.error(`Couldn't udate cached levels, something went wrong with sequelize: ${error}`);
			}
		}
		logger.info('Successfully updated cached levels.');
	},
};