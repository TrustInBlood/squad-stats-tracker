// src/events/ready.js
const logger = require('../utils/logger');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    logger.info(`Ready! Logged in as ${client.user.tag}`);
    
    client.user.setPresence({
      activities: [{ 
        type: 4,
        name: 'Squad Stats',
        state: 'Squad Stats',
      }],
      status: 'online',
    });

    try {
      // Use the serverManager instance from client
      const status = client.serverManager.getConnectionStatus();
      logger.info('Server connection status:', {
        total: status.total,
        connected: status.connected,
        pending: status.pending,
        servers: status.servers,
      });

      client.user.setPresence({
        activities: [{ 
          type: 4,
          name: `Squad Stats (${status.connected}/${status.total} servers)`,
          state: `Squad Stats (${status.connected}/${status.total} servers)`,
        }],
        status: status.connected > 0 ? 'online' : 'idle',
      });
    } catch (error) {
      logger.error('Failed to initialize server manager:', error);
      client.user.setPresence({
        activities: [{ 
          type: 4,
          name: 'Squad Stats (Error)',
          state: 'Squad Stats (Error)',
        }],
        status: 'dnd',
      });
    }
  },
};