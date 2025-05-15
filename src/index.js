require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const logger = require('./utils/logger');
const { testConnection } = require('./config/database');

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

// Test database connection and load commands/events regardless of result
testConnection()
    .then((isConnected) => {
        if (!isConnected) {
            logger.warn('Bot is running in degraded mode - database features will be unavailable');
        }
        // Load commands and events
        require('./handlers/commands')(client);
        require('./handlers/events')(client);
    })
    .catch(error => {
        logger.error('Error during database initialization:', error);
        logger.warn('Bot is running in degraded mode - database features will be unavailable');
        // Still load commands and events
        require('./handlers/commands')(client);
        require('./handlers/events')(client);
    });

// Error handling
process.on('unhandledRejection', error => {
    logger.error('Unhandled promise rejection:', error);
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