// database/index.js
const { sequelize } = require('../config/database');
const Player = require('./player')(sequelize);
const Server = require('./server')(sequelize);
const PlayerDamage = require('./player-damage')(sequelize);
const PlayerDeath = require('./player-death')(sequelize);
const PlayerWound = require('./player-wound')(sequelize);
const PlayerRevive = require('./player-revive')(sequelize);
const DiscordSteamLink = require('./discord-steam-link')(sequelize);

module.exports = {
  Player,
  Server,
  PlayerDamage,
  PlayerDeath,
  PlayerWound,
  PlayerRevive,
  DiscordSteamLink,
  sequelize  // Export sequelize instance
};