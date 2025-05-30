require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const logger = require('./utils/logger');
const { initializeDatabase } = require('./database/init');
const ServerManager = require('./utils/server-manager');
const { sequelize } = require('./database/models');

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

// Initialize database and load commands/events
Promise.all([
    initializeDatabase(),
    serverManager.connectToAllServers()
]).then(([dbInitialized, _]) => {
    if (!dbInitialized) {
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

// Handle graceful shutdown
async function shutdown(signal) {
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    
    try {
        // Shutdown server manager first to flush any buffered events
        await serverManager.shutdown();
        
        // Close database connection
        await sequelize.close();
        logger.info('Database connection closed');
        
        // Exit process
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
    }
}

// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

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