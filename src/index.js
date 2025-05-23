require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const logger = require('./utils/logger');
const { testConnection } = require('./config/database');
const ServerManager = require('./utils/serverManager');

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Initialize collections for commands and events
client.commands = new Collection();

// Create server manager instance
const serverManager = new ServerManager();

// Test database connection and load commands/events regardless of result
Promise.all([
    testConnection(),
    serverManager.connectToAllServers()
]).then(([dbConnected, _]) => {
    if (!dbConnected) {
        logger.warn('Bot is running in degraded mode - database features will be unavailable');
    }
    // Load commands and events
    require('./handlers/commands')(client);
    require('./handlers/events')(client);
}).catch(error => {
    logger.error('Error during initialization:', error);
    logger.warn('Bot is running in degraded mode - some features may be unavailable');
    // Still load commands and events
    require('./handlers/commands')(client);
    require('./handlers/events')(client);
});

// Error handling
process.on('unhandledRejection', error => {
    logger.error('Unhandled promise rejection:', error);
});

// Cleanup on process termination
process.on('SIGINT', async () => {
    logger.info('Shutting down...');
    try {
        serverManager.disconnectFromAllServers();
        await client.destroy();
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
    }
});

// Login to Discord with your client's token
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
    }
}

startBot(); 