const { Events } = require('discord.js');
const { Collection } = require('discord.js');
const logger = require('log4js').getLogger();

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {

		if (interaction.isChatInputCommand()) {

			// Chat command //

			// Check command's name
			const command = interaction.client.commands.get(interaction.commandName);

			if (!command) {
				logger.error('Event - ' + `No command matching ${interaction.commandName} was found.`);
				return;
			}

			const { cooldowns } = interaction.client;

			// Check if there's a cooldown
			if (!cooldowns.has(command.data.name)) {
				cooldowns.set(command.data.name, new Collection());
			}

			const now = Date.now();
			const timestamps = cooldowns.get(command.data.name);
			const defaultCooldownDuration = 3;
			const cooldownAmount = (command.cooldown ?? defaultCooldownDuration) * 1000;

			if (timestamps.has(interaction.user.id)) {
				const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

				if (now < expirationTime) {
					const expiredTimestamp = Math.round(expirationTime / 1000);
					return interaction.reply({ content: `Please wait, you are on a cooldown for \`${command.data.name}\`. You can use it again <t:${expiredTimestamp}:R>.`, ephemeral: true });
				}
			}

			timestamps.set(interaction.user.id, now);
			setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

			// Execute command
			try {
				logger.info('Event - ' + `Command ran - ${interaction.guildId ? `${interaction.client.guilds.cache.find(g => g.id == interaction.guildId)?.name} (${interaction.guildId})` : 'DM'} - ${interaction.user.tag} (${interaction.user.id}) - ${interaction.commandName}`);
				await command.execute(interaction);
			} catch (error) {
				logger.error('Event - ' + `Error executing ${interaction.commandName}`);
				logger.error('Event - ' + error);
			}
		} else if (interaction.isAutocomplete()) {
			const command = interaction.client.commands.get(interaction.commandName);

			if (!command) {
				logger.error('Event - ' + `No command matching ${interaction.commandName} was found.`);
				return;
			}

			try {
				await command.autocomplete(interaction);
			} catch (error) {
				logger.error('Event - ' + error);
			}
		} else if (interaction.isButton()) {

			// Handle button interactions //
			const button = interaction.client.buttons.get(interaction.customId);
			if (button) {
				// Execute code
				try {
					if (button.ephemeral != null) await interaction.deferReply({ ephemeral: button.ephemeral });
					await button.execute(interaction);
				} catch (error) {
					logger.error('Event - ' + `Error executing ${interaction.customId}`);
					logger.error('Event - ' + error);
				}
			}
		}
	},
};