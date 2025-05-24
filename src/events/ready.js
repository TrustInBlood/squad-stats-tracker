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
                state: 'Squad Stats',
                type: 4 // Custom
            }],
            status: 'online'
        });

        // Initialize server manager
        try {
            await serverManager.connectToAllServers();
            
            // Log detailed connection status
            const status = serverManager.getConnectionStatus();
            logger.info('Server connection status:', {
                total: status.total,
                connected: status.connected,
                pending: status.pending,
                servers: status.servers
            });

            // Update bot status to show connection status
            client.user.setPresence({
                activities: [{ 
                    state: `Squad Stats (${status.connected}/${status.total} servers)`,
                    type: 4 // Custom
                }],
                status: status.connected > 0 ? 'online' : 'idle'
            });
        } catch (error) {
            logger.error('Failed to initialize server manager:', error);
            client.user.setPresence({
                activities: [{ 
                    state: 'Squad Stats (Error)',
                    type: 4 // Custom
                }],
                status: 'dnd' // Do Not Disturb
            });
        }
    },
}; 