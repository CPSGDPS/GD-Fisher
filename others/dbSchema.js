const { DataTypes } = require('sequelize');
const lists = require('./lists.js');

module.exports = {
	createDbSchema(sequelize) {
		const db = {};

		db.user_settings = sequelize.define('settings_users', {
			user: {
				type: DataTypes.STRING,
				primaryKey: true,
			},
			default_list: {
				type: DataTypes.STRING,
			},
		},
		{
			freezeTableName: true,
		});

		db.guild_settings = sequelize.define('settings_guilds', {
			guild: {
				type: DataTypes.STRING,
				primaryKey: true,
			},
			default_list: {
				type: DataTypes.STRING,
			},
		},
		{
			freezeTableName: true,
		});
		
		for (const list of lists) {
			db[list.value] = sequelize.define(`data_${list.value}`, {
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
			},
			{
				freezeTableName: true,
			});
		}

		db.tags = sequelize.define('tags', {
			user: {
				type: DataTypes.STRING,
			},
			tag: {
				type: DataTypes.STRING,
			},
		},
		{
			freezeTableName: true,
		});

		db.processed = sequelize.define('processed', {
			id: {
				type: DataTypes.STRING,
				primaryKey: true,
			},
		},
		{
			freezeTableName: true,
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
		},
		{
			freezeTableName: true,
		});
	return db;
	},
	createCacheSchema(sequelize) {
		const cache = {};
		for (const list of lists) {
			cache[list.value] = sequelize.define(`cache_${list.value}`, {
				name: {
					type: DataTypes.STRING,
				},
				position: {
					type: DataTypes.INTEGER,
				},
				filename: {
					type: DataTypes.STRING,
				},
			},
			{
				freezeTableName: true,
			});
		}
		return cache;
	}
}