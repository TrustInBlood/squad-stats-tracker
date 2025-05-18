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

        for (const serverConfig of this.config.servers) {
            await this.connectToServer(serverConfig);
        }
    }

    async connectToServer(serverConfig) {
        if (this.servers.has(serverConfig.id)) {
            logger.warn(`Server ${serverConfig.id} is already connected`);
            return;
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
            logger.error(`Failed to connect to server ${serverConfig.id}`);
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
}

module.exports = ServerManager; 