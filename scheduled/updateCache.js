const { cloneOrPullRepo, parseLevels } = require('../others/gitUtils.js');
const logger = require('log4js').getLogger();

module.exports = {
	name: 'updateCache',
	cron: '30 * * * *',
	enabled: true,
	async execute() {
		const { db } = require('../index.js');

		logger.info('Updating cached levels...');
		await cloneOrPullRepo();
		logger.info('Parsing levels...');
		const levels = await parseLevels();
		
		db.cache.destroy({ where: {}});
			try {
				db.cache.bulkCreate(levels);
				logger.info(`Successfully updated ${levels.length} cached levels.`);
			} catch (error) {
				logger.error(`Couldn't udate cached levels, something went wrong with sequelize: ${error}`);
			}
	},
};