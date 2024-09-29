// @ts-ignore
const { DataTypes } = require('sequelize');

module.exports = {
	createDbSchema(sequelize) {
		const db = {};
		db.cache = sequelize.define('cache', {
			name: {
				type: DataTypes.STRING,
			},
			position: {
				type: DataTypes.INTEGER,
			},
			filename: {
				type: DataTypes.STRING,
			},
		});

		db.users = sequelize.define('users', {
			user: {
				type: DataTypes.STRING,
			},
			amount: {
				type: DataTypes.DOUBLE,
			},
			mean: {
				type: DataTypes.DOUBLE,
			},
			fished_list: {
				type: DataTypes.TEXT,
			},
			fished_list_frequency: {
				type: DataTypes.TEXT,
			},
			times_fished: {
				type: DataTypes.INTEGER,
			},
		});

		db.tags = sequelize.define('tags', {
			user: {
				type: DataTypes.STRING,
			},
			tag: {
				type: DataTypes.STRING,
			},
		});

		db.processed = sequelize.define('processed', {
			id: {
				type: DataTypes.STRING,
				primaryKey: true,
			},
		});

		db.guilds = sequelize.define('guilds', {
			guild_id: {
				type: DataTypes.STRING,
				primaryKey: true,
			},
			guild_name: {
				type: DataTypes.STRING,
			},
			guild_member_count: {
				type: DataTypes.INTEGER,
			},
			enabled: {
				type: DataTypes.BOOLEAN,
			},
		});
	return db;
	}
}