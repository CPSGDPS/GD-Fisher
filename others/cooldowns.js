const { Collection } = require('discord.js');
const cooldowns = new Collection();

module.exports = {
	listCooldown: 3600,
	checkCooldown: (user, list) => {
		const userListKey = `${user}-${list}`;
		const cooldownAmount = module.exports.listCooldown * 1000;
		const now = Date.now();
		if (cooldowns.has(userListKey)) {
			const expirationTime = cooldowns.get(userListKey) + cooldownAmount;
			if (now < expirationTime) {
				const expiredTimestamp = Math.round(expirationTime / 1000);
				return expiredTimestamp;
			}
		}
		cooldowns.set(userListKey, now);
		setTimeout(() => {
			cooldowns.delete(userListKey);
		}, cooldownAmount);
		return null;
	}
};