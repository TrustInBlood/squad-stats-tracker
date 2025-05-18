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
    }

    async connect() {
        try {
            // Start watching the log file
            await this.startLogWatcher();
            this.connected = true;
            this.emit('connected', this.config.id);
            return true;
        } catch (error) {
            logger.error(`Failed to connect to server ${this.config.id}:`, error);
            return false;
        }
    }

    startLogWatcher() {
        if (this.logWatcher) {
            this.logWatcher.close();
        }

        const logPath = path.join(this.config.logDir, 'SquadGame.log');
        
        try {
            // Read the last few lines of the log file to get current state
            const logContent = fs.readFileSync(logPath, 'utf-8');
            const lines = logContent.split('\n').slice(-1000);
            
            // Process existing log lines
            lines.forEach(line => this.logParser.parseLine(line));

            // Start watching the log file for new entries
            this.logWatcher = fs.watch(logPath, (eventType, filename) => {
                if (eventType === 'change') {
                    try {
                        const newContent = fs.readFileSync(logPath, 'utf-8');
                        const newLines = newContent.split('\n').slice(-100); // Get last 100 lines
                        newLines.forEach(line => this.logParser.parseLine(line));
                    } catch (error) {
                        logger.error(`Error reading log file for server ${this.config.id}:`, error);
                    }
                }
            });

            logger.info(`Started watching log file for server ${this.config.id}`);
        } catch (error) {
            logger.error(`Error setting up log watcher for server ${this.config.id}:`, error);
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
    }
}

module.exports = SquadServerConnection; 