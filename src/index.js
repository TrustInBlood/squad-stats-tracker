require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const logger = require('./utils/logger');
const { initializeDatabase } = require('./database/init');
const ServerManager = require('./utils/server-manager');
const { sequelize } = require('./database/connection');
const { initializeWeaponCache } = require('./utils/weapon-utils');
const { startScheduler } = require('./utils/scheduler');
const { initLeaderboardCron } = require('./utils/leaderboard');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();
client.serverManager = new ServerManager(client);

// Track initialization state
let dbInitialized = false;

// Initialize leaderboards when both database and client are ready
async function initializeLeaderboard() {
  if (dbInitialized && client.isReady()) {
    logger.info('Both database and client are ready, initializing leaderboards...');
    // Initialize 24-hour leaderboard
    initLeaderboardCron(client, sequelize, '24h', '24h');
    // Initialize 7-day leaderboard
    initLeaderboardCron(client, sequelize, '7d', '7d');
  }
}

Promise.all([
  initializeDatabase(),
  client.serverManager.connectToAllServers(),
]).then(async ([dbInitResult, _]) => {
  dbInitialized = dbInitResult;
  if (!dbInitialized) {
    logger.info('Bot is running in degraded mode - database features will be unavailable');
  } else {
    try {
      await initializeWeaponCache();
      logger.info('Weapon cache initialized successfully');
      startScheduler();
      // Check if we can initialize leaderboards now
      initializeLeaderboard();
    } catch (error) {
      logger.error('Failed to initialize weapon cache, running without weapon caching:', error);
    }
  }
  require('./handlers/commands')(client);
  require('./handlers/events')(client);
}).catch(error => {
  logger.error('Error during initialization:', error);
  logger.info('Bot is running in degraded mode - some features may be unavailable');
  require('./handlers/commands')(client);
  require('./handlers/events')(client);
});

// Initialize leaderboards when client becomes ready
client.once('ready', () => {
  logger.info('Discord client is ready, checking if we can initialize leaderboards...');
  initializeLeaderboard();
});

process.on('unhandledRejection', error => {
  logger.error('Unhandled promise rejection:', error);
});

async function shutdown(signal) {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  try {
    await client.serverManager.shutdown();
    if (client.isReady()) {
      client.destroy();
      logger.info('Discord client destroyed');
    }
    await sequelize.close();
    logger.info('Database connection closed');
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

async function startBot() {
  try {
    await client.login(process.env.DISCORD_TOKEN);
    logger.info('Bot is now online!');
  } catch (error) {
    if (error.message.includes('disallowed intents')) {
      logger.error('Bot requires privileged intents. Enable MESSAGE CONTENT and SERVER MEMBERS intents in Discord Developer Portal');
    } else {
      logger.error('Error logging in:', error);
    }
    process.exit(1);
  }
}

startBot();