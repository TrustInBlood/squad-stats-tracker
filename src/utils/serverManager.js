const SquadServerConnection = require('./serverConnection');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class ServerManager extends EventEmitter {
    constructor() {
        super();
        this.servers = new Map();
        this.config = null;
        this.loadConfig();
    }

    loadConfig() {
        try {
            const configPath = path.join(process.cwd(), 'config', 'servers.json');
            const configData = fs.readFileSync(configPath, 'utf-8');
            this.config = JSON.parse(configData);
            logger.info('Loaded server configuration');
        } catch (error) {
            logger.error('Failed to load server configuration:', error);
            throw error;
        }
    }

    async connectToAllServers() {
        if (!this.config || !this.config.servers) {
            throw new Error('Server configuration not loaded');
        }

        const connectionPromises = this.config.servers.map(serverConfig => 
            this.connectToServer(serverConfig).catch(error => {
                logger.error(`Failed to connect to server ${serverConfig.id}, will retry automatically:`, error);
                return null; // Don't throw, let the server connection handle retries
            })
        );

        // Wait for all initial connection attempts
        await Promise.all(connectionPromises);
        
        // Log connection status
        const connectedCount = Array.from(this.servers.values()).filter(s => s.connected).length;
        logger.info(`Server manager initialized. ${connectedCount}/${this.config.servers.length} servers connected. Others will retry automatically.`);
    }

    async connectToServer(serverConfig) {
        if (this.servers.has(serverConfig.id)) {
            const existingServer = this.servers.get(serverConfig.id);
            if (existingServer.connected) {
                logger.warn(`Server ${serverConfig.id} is already connected`);
                return;
            }
            // If server exists but isn't connected, remove it and try again
            existingServer.disconnect();
            this.servers.delete(serverConfig.id);
        }

        const server = new SquadServerConnection(serverConfig);
        
        // Set up event handlers
        server.on('connected', (serverId) => {
            logger.info(`Server ${serverId} connected successfully`);
        });

        server.on('disconnected', (serverId) => {
            logger.info(`Server ${serverId} disconnected`);
        });

        server.on('error', (error) => {
            logger.error(`Server ${serverConfig.id} error:`, error);
        });

        server.on('kill', (killData) => {
            // Emit the kill event with server ID
            this.emit('kill', killData);
        });

        // Connect to the server
        const connected = await server.connect();
        if (connected) {
            this.servers.set(serverConfig.id, server);
            logger.info(`Successfully connected to server ${serverConfig.id}`);
        } else {
            // Even if not connected, store the server instance as it will retry
            this.servers.set(serverConfig.id, server);
            logger.info(`Server ${serverConfig.id} connection pending, will retry automatically`);
        }
    }

    disconnectFromServer(serverId) {
        const server = this.servers.get(serverId);
        if (server) {
            server.disconnect();
            this.servers.delete(serverId);
            logger.info(`Disconnected from server ${serverId}`);
        }
    }

    disconnectFromAllServers() {
        for (const [serverId, server] of this.servers) {
            server.disconnect();
            this.servers.delete(serverId);
        }
        logger.info('Disconnected from all servers');
    }

    getServer(serverId) {
        return this.servers.get(serverId);
    }

    getAllServers() {
        return Array.from(this.servers.values());
    }

    isServerConnected(serverId) {
        const server = this.servers.get(serverId);
        return server ? server.connected : false;
    }

    getConnectionStatus() {
        const status = {
            total: this.config.servers.length,
            connected: 0,
            pending: 0,
            servers: {}
        };

        for (const [id, server] of this.servers) {
            const isConnected = server.connected;
            status.servers[id] = isConnected ? 'connected' : 'pending';
            if (isConnected) status.connected++;
            else status.pending++;
        }

        return status;
    }
}

module.exports = ServerManager; 