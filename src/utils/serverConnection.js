const logger = require('./logger');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const LogParser = require('./logParser');

class SquadServerConnection extends EventEmitter {
    constructor(serverConfig) {
        super();
        this.config = serverConfig;
        this.connected = false;
        this.logWatcher = null;
        this.logParser = new LogParser();
        this.retryAttempts = 0;
        this.maxRetryAttempts = 10;
        this.retryDelay = 30000; // 30 seconds
        
        // Forward log parser events
        this.logParser.on('PLAYER_DIED', (data) => {
            this.emit('kill', {
                serverId: this.config.id,
                timestamp: new Date(data.time),
                killer: data.attackerPlayerController,
                victim: data.victimName,
                weapon: data.weapon,
                damage: data.damage,
                attackerIDs: data.attackerIDs,
                chainID: data.chainID
            });
        });

        // Add detailed logging for log parser
        this.logParser.on('line_parsed', (line) => {
            logger.debug(`[LogParser][${this.config.id}] Parsed line: ${line.substring(0, 100)}...`);
        });
    }

    async connect() {
        try {
            logger.info(`[ServerConnection][${this.config.id}] Attempting to connect to server...`);
            // Start watching the log file
            await this.startLogWatcher();
            this.connected = true;
            this.emit('connected', this.config.id);
            logger.info(`[ServerConnection][${this.config.id}] Successfully connected to server`);
            return true;
        } catch (error) {
            logger.error(`[ServerConnection][${this.config.id}] Failed to connect:`, error);
            
            // If the log file doesn't exist, retry after delay
            if (error.code === 'ENOENT' && this.retryAttempts < this.maxRetryAttempts) {
                this.retryAttempts++;
                logger.info(`[ServerConnection][${this.config.id}] Log file not found. Retry attempt ${this.retryAttempts}/${this.maxRetryAttempts} in ${this.retryDelay/1000} seconds`);
                
                setTimeout(() => {
                    this.connect().catch(err => {
                        logger.error(`[ServerConnection][${this.config.id}] Retry connection failed:`, err);
                    });
                }, this.retryDelay);
                
                return false;
            }
            
            return false;
        }
    }

    async startLogWatcher() {
        if (this.logWatcher) {
            this.logWatcher.close();
            this.logWatcher = null;
        }

        const logPath = path.join(this.config.logDir, 'SquadGame.log');
        logger.info(`[ServerConnection][${this.config.id}] Attempting to watch log file at: ${logPath}`);
        
        try {
            // Check if directory exists
            const logDir = path.dirname(logPath);
            if (!fs.existsSync(logDir)) {
                logger.error(`[ServerConnection][${this.config.id}] Log directory does not exist: ${logDir}`);
                throw new Error(`Log directory does not exist: ${logDir}`);
            }
            logger.info(`[ServerConnection][${this.config.id}] Log directory exists: ${logDir}`);

            // List directory contents
            try {
                const dirContents = fs.readdirSync(logDir);
                logger.info(`[ServerConnection][${this.config.id}] Log directory contents:`, dirContents);
            } catch (dirError) {
                logger.error(`[ServerConnection][${this.config.id}] Error reading log directory:`, dirError);
            }

            // Check if file exists
            if (!fs.existsSync(logPath)) {
                logger.error(`[ServerConnection][${this.config.id}] Log file does not exist: ${logPath}`);
                throw new Error(`Log file does not exist: ${logPath}`);
            }
            logger.info(`[ServerConnection][${this.config.id}] Log file exists: ${logPath}`);

            // Get file stats
            try {
                const stats = fs.statSync(logPath);
                logger.info(`[ServerConnection][${this.config.id}] Log file stats:`, {
                    size: stats.size,
                    created: stats.birthtime,
                    modified: stats.mtime,
                    permissions: stats.mode.toString(8)
                });
            } catch (statError) {
                logger.error(`[ServerConnection][${this.config.id}] Error getting file stats:`, statError);
            }

            // Read the last few lines of the log file to get current state
            const logContent = fs.readFileSync(logPath, 'utf-8');
            const lines = logContent.split('\n').slice(-1000);
            logger.info(`[ServerConnection][${this.config.id}] Read ${lines.length} lines from log file`);
            
            // Process existing log lines
            let parsedCount = 0;
            lines.forEach(line => {
                if (line.trim()) {
                    this.logParser.parseLine(line);
                    parsedCount++;
                }
            });
            logger.info(`[ServerConnection][${this.config.id}] Parsed ${parsedCount} existing log lines`);

            // Start watching the log file for new entries
            this.logWatcher = fs.watch(logPath, (eventType, filename) => {
                if (eventType === 'change') {
                    try {
                        const newContent = fs.readFileSync(logPath, 'utf-8');
                        const newLines = newContent.split('\n').slice(-100); // Get last 100 lines
                        let newParsedCount = 0;
                        newLines.forEach(line => {
                            if (line.trim()) {
                                this.logParser.parseLine(line);
                                newParsedCount++;
                            }
                        });
                        if (newParsedCount > 0) {
                            logger.debug(`[ServerConnection][${this.config.id}] Parsed ${newParsedCount} new log lines`);
                        }
                    } catch (error) {
                        logger.error(`[ServerConnection][${this.config.id}] Error reading new log lines:`, error);
                    }
                }
            });

            logger.info(`[ServerConnection][${this.config.id}] Started watching log file`);
            this.retryAttempts = 0; // Reset retry attempts on successful connection
        } catch (error) {
            logger.error(`[ServerConnection][${this.config.id}] Error setting up log watcher:`, error);
            throw error;
        }
    }

    disconnect() {
        if (this.logWatcher) {
            this.logWatcher.close();
            this.logWatcher = null;
        }
        this.connected = false;
        this.logParser.clearSession();
        this.emit('disconnected', this.config.id);
        logger.info(`[ServerConnection][${this.config.id}] Disconnected from server`);
    }
}

module.exports = SquadServerConnection; 