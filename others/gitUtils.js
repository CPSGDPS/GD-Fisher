const fs = require('fs');
const path = require('path');
const logger = require('log4js').getLogger();
const localRepoPath = path.resolve(__dirname, '../data/repo');

module.exports = {
	async cloneOrPullRepo() {
		const { git } = require('../index');

		logger.info('Updating GitHub repository...');
		const repoUrl = process.env.GITHUB_REPO_URL;
		
		if (!fs.existsSync(localRepoPath)) {
			logger.info('Cloning the repository for the first time...');
			await git.clone(repoUrl, localRepoPath);
		} else {
			logger.info('Pulling the latest changes from the repository...');
			await git.cwd(localRepoPath).pull();
		}
		logger.info('Successfully updated the repository');
		
	},
	async parseLevels() {
		const levels = [];
		let list_data;
		try {
			list_data = JSON.parse(fs.readFileSync(path.join(localRepoPath, 'data/_list.json'), 'utf8'));
		} catch (parseError) {
			logger.error(`Unable to parse data from _list.json:\n${parseError}`);
			return -1;
		}

		let i = 1;
		for (const filename of list_data) {
			let parsedData;
			try {
				parsedData = JSON.parse(fs.readFileSync(path.join(localRepoPath, `data/${filename}.json`), 'utf8'));
			} catch (parseError) {
				logger.error(`Unable to parse data from ${filename}.json:\n${parseError}`);
				continue;
			}
			
			levels.push({ name: parsedData.name, position: i, filename: filename});
			i++;
		}
		return levels;
	}
}