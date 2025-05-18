const logger = require('../utils/logger');
const ServerManager = require('../utils/serverManager');

// Create a single server manager instance for the bot
const serverManager = new ServerManager();

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        logger.info(`Ready! Logged in as ${client.user.tag}`);
        
        // Set bot status
        client.user.setPresence({
            activities: [{ 
                name: 'Squad Stats',
                type: 2 // Watching
            }],
            status: 'online'
        });

        // Initialize server manager
        try {
            await serverManager.connectToAllServers();
            logger.info('Server manager initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize server manager:', error);
        }
    },
}; 