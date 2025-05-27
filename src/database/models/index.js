// database/index.js
const Player = require('./player');
const Server = require('./server');
const PlayerDamage = require('./player-damage');
const PlayerDeath = require('./player-death');
const PlayerWound = require('./player-wound');
const PlayerRevive = require('./player-revive');

module.exports = {
  Player,
  Server,
  PlayerDamage,
  PlayerDeath,
  PlayerWound,
  PlayerRevive,
  // More models will be added here as we create them
  // DiscordSteamLink,
  // DailyPlayerStats,
  // etc.
};