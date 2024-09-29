const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	enabled: true,
	cooldown: 3600,
	data: new SlashCommandBuilder()
		.setName('fish')
		.setDescription('AREDL Fishy'),
	async execute(interaction) {
		const { db } = require('../index.js');
		const baseFactor = 0.0005832492374192035997815;

		const id = interaction.user.id;
		const name = interaction.user.tag;

		const levels = await db.cache.findAll({ order: [['position', 'ASC']]});
		if (!levels || levels.length === 0) {
			return await interaction.reply(':x: No levels available');
		}

		const level_count = levels.length;
		const fished_pos = Math.floor(Math.random() * level_count);
		const fished_level_name = levels[fished_pos].name;
		const fished_level_file = levels[fished_pos].filename;

		const b = (level_count - 1) * baseFactor;
		const a = 600 * Math.sqrt(b);
		const fished_score = (a / Math.sqrt(fished_pos / 50 + b) - 100);
		
		const userdata = await db.users.findOne({ where: { user: id } });
		let totalAmount;

		if (!userdata) {
			await db.users.create({
				user: id,
				amount: fished_score,
				mean: fished_score,
				fished_list: `["${fished_level_file}"]`,
				fished_list_frequency: '[1]',
				times_fished: 1
			});
			totalAmount = fished_score;
		} else {
			totalAmount = userdata.amount + fished_score;
			timesFished = userdata.times_fished + 1;
			meanScore = totalAmount / timesFished;
			let fishedListData, fishedListFrequencyData;
			try {
				fishedListData = userdata.fished_list ? JSON.parse(userdata.fished_list) : [];
				fishedListFrequencyData = userdata.fished_list_frequency ? JSON.parse(userdata.fished_list_frequency) : [];
			}
			catch (error) {
				logger.error(error);
				return await interaction.reply(':x: An error occurred while getting the fished list data.');
			}
			const fishedIndex = fishedListData.indexOf(fished_level_file);
			if (fishedIndex === -1) {
				fishedListData.push(fished_level_file);
				fishedListFrequencyData.push(1);
			} else {
				fishedListFrequencyData[fishedIndex] += 1;
			}

			let fishedList, fishedListFrequency;
			try {
				fishedList = JSON.stringify(fishedListData);
				fishedListFrequency = JSON.stringify(fishedListFrequencyData);
			} catch (error) {
				logger.error(error);
				return await interaction.reply(':x: An error occurred while saving the fished list data.');
			}

			try {
			await db.users.update({
					amount: totalAmount,
					mean: meanScore,
					fished_list: fishedList,
					fished_list_frequency: fishedListFrequency,
					times_fished: timesFished
				}, {
					where: { user: id }
				});
			} catch (error) {
				logger.error(error);
				return await interaction.reply(':x: An error occurred while updating the user data.');
			}
		}

		return await interaction.reply(`> **${name}** fished **${fished_level_name}** (TOP ${fished_pos + 1})\n> +${Math.round(fished_score * 100) / 100} points (Total: ${Math.round(totalAmount * 100) / 100} points)`);
	},
};
