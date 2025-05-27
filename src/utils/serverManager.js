const logger = require('./logger');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { io } = require('socket.io-client');
const WebSocket = require('ws');
const EventBuffer = require('./eventBuffer');

class ServerManager extends EventEmitter {
    constructor() {
        super();
        this.servers = new Map();
        this.config = null;
        this.isInitialized = false;
        this.reconnectAttempts = new Map();
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000; // 5 seconds
        this.eventBuffer = new EventBuffer({
            flushInterval: 5000, // Flush every 5 seconds
            maxBufferSize: 1000, // Maximum events per type before forced flush
            maxAge: 10000 // Maximum age of events in buffer (10 seconds)
        });

        // Add chat verification handler
        this.chatVerificationHandler = null;

        this.loadConfig();

        // Start monitoring buffer sizes
        this.startBufferMonitoring();
    }

    loadConfig() {
        try {
            const configPath = path.join(process.cwd(), 'src', 'config', 'servers.js');
            this.config = require(configPath);
            
            // Validate config structure
            if (!this.config || !Array.isArray(this.config.servers)) {
                throw new Error('Invalid server configuration: servers must be an array');
            }
            
            // Validate each server config
            this.config.servers.forEach((server, index) => {
                if (!server.id || !server.url || !server.token) {
                    throw new Error(`Invalid server configuration at index ${index}: missing required fields (id, url, token)`);
                }
                if (!server.url.startsWith('ws://') && !server.url.startsWith('wss://')) {
                    throw new Error(`Invalid server URL for server ${server.id}: must start with ws:// or wss://`);
                }
                // Set default logStats to true if not specified
                if (server.logStats === undefined) {
                    server.logStats = true;
                }
            });

            logger.info('Loaded server configuration');
        } catch (error) {
            logger.error('Failed to load server configuration:', error);
            throw error;
        }
    }

    async connectToAllServers() {
        if (this.isInitialized) {
            logger.warn('Server manager already initialized');
            return;
        }

        if (!this.config || !this.config.servers) {
            throw new Error('Server configuration not loaded');
        }

        try {
            const connectionPromises = this.config.servers.map(serverConfig => 
                this.connectToServer(serverConfig).catch(error => {
                    logger.error(`Failed to connect to server ${serverConfig.id}, will retry automatically:`, error);
                    return null;
                })
            );

            await Promise.all(connectionPromises);
            
            const connectedCount = Array.from(this.servers.values()).filter(s => s.connected).length;
            logger.info(`Server manager initialized. ${connectedCount}/${this.config.servers.length} servers connected. Others will retry automatically.`);
            
            this.isInitialized = true;
        } catch (error) {
            logger.error('Failed to initialize server manager:', error);
            throw error;
        }
    }

    async connectToServer(serverConfig) {
        if (!serverConfig || !serverConfig.id || !serverConfig.url || !serverConfig.token) {
            throw new Error('Invalid server configuration: missing required fields');
        }

        if (this.servers.has(serverConfig.id)) {
            const existingServer = this.servers.get(serverConfig.id);
            if (existingServer.connected) {
                logger.warn(`Server ${serverConfig.id} is already connected`);
                return;
            }
            existingServer.socket.disconnect();
            this.servers.delete(serverConfig.id);
        }

        const socket = io(serverConfig.url, {
            auth: { token: serverConfig.token },
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 30000,
            timeout: 20000
        });

        // Add raw message logging
        socket.on('message', (message) => {
            logger.debug(`Raw message received from ${serverConfig.id}:`, message);
        });

        // Add error logging for socket
        socket.on('error', (error) => {
            logger.error(`Socket error for ${serverConfig.id}:`, error);
        });

        const server = {
            id: serverConfig.id,
            socket,
            connected: false,
            retryAttempts: 0,
            maxRetryAttempts: 10,
            retryDelay: 30000, // 30 seconds
            reconnectTimeout: null,
            config: serverConfig  // Store the config for logStats check
        };

        socket.on('connect', () => {
            server.connected = true;
            server.retryAttempts = 0;
            logger.info(`Connected to ${serverConfig.id} (${serverConfig.url})`);
            this.emit('connected', serverConfig.id);
        });

        socket.on('disconnect', (reason) => {
            server.connected = false;
            logger.info(`Disconnected from ${serverConfig.id} (reason: ${reason})`);
            this.emit('disconnected', serverConfig.id);
            this.handleReconnect(server, serverConfig);
        });

        socket.on('connect_error', (err) => {
            logger.error(`Connection error for ${serverConfig.id}:`, err.message);
            server.connected = false;
            this.handleReconnect(server, serverConfig);
        });

        // Forward all events from the socket to our event emitter
        socket.onAny((eventName, ...args) => {
            try {
                logger.debug(`Socket event received from ${serverConfig.id}:`, {
                    event: eventName,
                    data: args[0]  // Log the actual event data
                });

                if (serverConfig.logStats) {
                    // Structure event data with nested data field
                    const eventData = {
                        event: eventName,
                        serverID: serverConfig.id,  // Note: serverID not serverId
                        timestamp: new Date().toISOString(),
                        data: args[0]  // Nest the actual event data under 'data'
                    };

                    // Add to buffer and emit
                    this.eventBuffer.addEvent(eventData);
                    this.emit(eventName, eventData);
                } else if (eventName === 'connect' || eventName === 'disconnect' || eventName === 'connect_error') {
                    // Always emit connection-related events regardless of logStats setting
                    this.emit(eventName, { 
                        serverID: serverConfig.id,  // Note: serverID not serverId
                        timestamp: new Date().toISOString(),
                        data: args[0]  // Nest connection event data too
                    });
                }
            } catch (error) {
                logger.error(`Error handling socket event ${eventName} from ${serverConfig.id}:`, error);
            }
        });

        this.servers.set(serverConfig.id, server);
        return new Promise((resolve) => {
            // Resolve after initial connection attempt
            socket.once('connect', () => resolve(true));
            socket.once('connect_error', () => resolve(false));
        });
    }

    handleReconnect(server, serverConfig) {
        if (server.reconnectTimeout) {
            clearTimeout(server.reconnectTimeout);
        }

        if (server.retryAttempts < server.maxRetryAttempts) {
            server.retryAttempts++;
            logger.info(`Attempting to reconnect to server ${serverConfig.id} (attempt ${server.retryAttempts}/${server.maxRetryAttempts}) in ${server.retryDelay/1000} seconds`);
            
            server.reconnectTimeout = setTimeout(() => {
                this.connectToServer(serverConfig).catch(error => {
                    logger.error(`Reconnection attempt failed for server ${serverConfig.id}:`, error);
                });
            }, server.retryDelay);
        } else {
            logger.error(`Max reconnection attempts reached for server ${serverConfig.id}`);
        }
    }

    disconnectFromServer(serverId) {
        const server = this.servers.get(serverId);
        if (server) {
            if (server.reconnectTimeout) {
                clearTimeout(server.reconnectTimeout);
            }
            server.socket.disconnect();
            this.servers.delete(serverId);
            logger.info(`Disconnected from server ${serverId}`);
        }
    }

    disconnectFromAllServers() {
        for (const [serverId, server] of this.servers) {
            if (server.reconnectTimeout) {
                clearTimeout(server.reconnectTimeout);
            }
            server.socket.disconnect();
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

    startBufferMonitoring() {
        // Log buffer sizes every minute
        setInterval(() => {
            const sizes = this.eventBuffer.getBufferSizes();
            const totalEvents = Object.values(sizes).reduce((a, b) => a + b, 0);
            if (totalEvents > 0) {
                logger.debug('Current event buffer sizes:', sizes);
            }
        }, 60000);
    }

    async shutdown() {
        logger.info('Shutting down server manager...');
        
        // Close all websocket connections
        for (const [serverId, server] of this.servers) {
            if (server.socket) {
                server.socket.disconnect();
            }
        }

        // Flush any remaining events in the buffer
        await this.eventBuffer.flushAll();
        
        // Stop the buffer monitoring
        this.eventBuffer.stopFlushInterval();
        
        logger.info('Server manager shutdown complete');
    }

    handleMessage(serverId, message) {
        try {
            const data = JSON.parse(message);
            const server = this.servers.get(serverId);

            if (!server) {
                logger.warn(`Received message for unknown server ${serverId}`);
                return;
            }

            // Add debug logging for incoming events
            if (data.event) {
                logger.debug(`Received ${data.event} event from ${serverId}:`, {
                    event: data.event,
                    serverID: serverId,
                    timestamp: data.timestamp,
                    // Log a subset of the data to avoid overwhelming logs
                    data: {
                        attacker: data.attacker,
                        victim: data.victim,
                        weapon: data.weapon,
                        damage: data.damage,
                        // Add player connection data to debug logs
                        steamID: data.steamID,
                        eosID: data.eosID,
                        name: data.name,
                        // Add chat message data
                        message: data.event === 'PLAYER_CHAT' ? data.message : undefined
                    }
                });
            }

            // Always handle chat events for verification, regardless of logStats setting
            if (data.event === 'PLAYER_CHAT') {
                const eventData = {
                    event: data.event,
                    serverID: serverId,
                    timestamp: new Date().toISOString(),
                    data: data
                };

                // Process chat for verification if handler exists
                if (this.chatVerificationHandler) {
                    this.chatVerificationHandler.handleChatMessage(eventData);
                }

                // If logStats is enabled, also buffer the chat event
                if (server.config.logStats) {
                    this.eventBuffer.addEvent(eventData);
                    this.emit(data.event, eventData);
                }
                return;
            }

            // Handle connection-related events
            if (data.event === 'PLAYER_CONNECTED' || data.event === 'PLAYER_DISCONNECTED') {
                // Always process player connection events regardless of logStats setting
                const eventData = {
                    event: data.event,
                    serverID: serverId,  // Note: serverID not serverId
                    timestamp: new Date().toISOString(),
                    data: data  // Nest the event data
                };

                // Add to buffer and emit
                this.eventBuffer.addEvent(eventData);
                this.emit(data.event, eventData);
                return;
            }

            // For other game events, check if we should log stats for this server
            if (server.config.logStats) {
                // Structure event data consistently
                const eventData = {
                    event: data.event,
                    serverID: serverId,  // Note: serverID not serverId
                    timestamp: new Date().toISOString(),
                    data: data  // Nest the event data
                };

                // Add to buffer instead of emitting directly
                this.eventBuffer.addEvent(eventData);

                // Still emit the event for any real-time listeners
                this.emit(data.event, eventData);
            }
        } catch (error) {
            logger.error(`Error handling message from server ${serverId}:`, error);
        }
    }

    // Add method to set chat verification handler
    setChatVerificationHandler(handler) {
        this.chatVerificationHandler = handler;
    }
}

module.exports = ServerManager; 