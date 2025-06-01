const logger = require('./logger');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { io } = require('socket.io-client');
const EventBuffer = require('./event-buffer');

class ServerManager extends EventEmitter {
  constructor(client) {
    super();
    this.servers = new Map();
    this.config = null;
    this.isInitialized = false;
    this.reconnectAttempts = new Map();
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000;
    this.eventBuffer = new EventBuffer({
      flushInterval: 5000,
      maxBufferSize: 100,
      maxAge: 10000,
    }, client);

    this.loadConfig();
    this.startBufferMonitoring();
  }

  loadConfig() {
    try {
      const configPath = path.join(process.cwd(), 'src', 'config', 'servers.js');
      this.config = require(configPath);
      if (!this.config || !Array.isArray(this.config.servers)) {
        throw new Error('Invalid server configuration: servers must be an array');
      }
      this.config.servers.forEach((server, index) => {
        if (!server.id || !server.url || !server.token) {
          throw new Error(`Invalid server configuration at index ${index}: missing required fields (id, url, token)`);
        }
        if (!server.url.startsWith('ws://') && !server.url.startsWith('wss://')) {
          throw new Error(`Invalid server URL for server ${server.id}: must start with ws:// or wss://`);
        }
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
      timeout: 20000,
    });

    socket.on('error', (error) => {
      logger.error(`Socket error for ${serverConfig.id}:`, error);
      socket.on('message', (message) => {
        logger.debug(`Raw message on error from ${serverConfig.id}:`, message);
      });
    });

    const server = {
      id: serverConfig.id,
      socket,
      connected: false,
      retryAttempts: 0,
      maxRetryAttempts: 10,
      retryDelay: 30000,
      reconnectTimeout: null,
      config: serverConfig,
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

    socket.onAny((eventName, ...args) => {
      try {
        if (eventName === 'CHAT_MESSAGE') {
          // Log chat events at info level since they're user-facing
          logger.info(`Chat event received from ${serverConfig.id}:`, {
            event: eventName,
            data: args[0],
          });
          if (serverConfig.logStats) {
            const eventData = {
              event: eventName,
              serverID: serverConfig.id,
              timestamp: new Date().toISOString(),
              data: args[0],
            };
            this.eventBuffer.addEvent(eventData);
          }
          this.emit(eventName, {
            event: eventName,
            serverID: serverConfig.id,
            timestamp: new Date().toISOString(),
            data: args[0],
          });
          return;
        }

        // Suppress general socket event logging unless there's an error
        if (serverConfig.logStats) {
          const eventData = {
            event: eventName,
            serverID: serverConfig.id,
            timestamp: new Date().toISOString(),
            data: args[0],
          };
          this.eventBuffer.addEvent(eventData);
          this.emit(eventName, eventData);
        } else if (eventName === 'connect' || eventName === 'disconnect' || eventName === 'connect_error') {
          const eventData = {
            event: eventName,
            serverID: serverConfig.id,
            timestamp: new Date().toISOString(),
            data: args[0],
          };
          this.emit(eventName, eventData);
        }
      } catch (error) {
        logger.error(`Error handling socket event ${eventName} from ${serverConfig.id}:`, {
          error: error.message,
          event: eventName,
          data: args[0],
        });
      }
    });

    this.servers.set(serverConfig.id, server);
    return new Promise((resolve) => {
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
      servers: {},
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
    this.bufferMonitorInterval = setInterval(() => {
      const sizes = this.eventBuffer.getBufferSizes();
      const totalEvents = Object.values(sizes).reduce((a, b) => a + b, 0);
      if (totalEvents > 0) {
        logger.debug('Current event buffer sizes:', sizes);
      }
    }, 60000);
  }

  async shutdown() {
    logger.info('Shutting down server manager...');
    for (const [serverId, server] of this.servers) {
      if (server.socket) {
        server.socket.disconnect();
      }
    }
    await this.eventBuffer.flushAll();
    this.eventBuffer.stopFlushInterval();
    if (this.bufferMonitorInterval) {
      clearInterval(this.bufferMonitorInterval);
    }
    logger.info('Server manager shutdown complete');
  }
}

module.exports = ServerManager;