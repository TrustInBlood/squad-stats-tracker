const logger = require('./logger');
const fs = require('fs').promises;
const path = require('path');
const { PlayerDamage, PlayerWound, PlayerDeath, PlayerRevive, Player, sequelize } = require('../database/models');

class EventBuffer {
    constructor(options = {}) {
        this.options = {
            flushInterval: options.flushInterval || 5000, // Flush every 5 seconds
            maxBufferSize: options.maxBufferSize || 1000, // Maximum events per type before forced flush
            maxAge: options.maxAge || 10000, // Maximum age of events in buffer (10 seconds)
            maxRetries: options.maxRetries || 5, // Maximum number of retry attempts
            deadLetterPath: options.deadLetterPath || path.join(process.cwd(), 'logs', 'dead-letter')
        };

        // Buffers for different event types
        this.buffers = {
            PLAYER_DAMAGED: [],
            PLAYER_WOUNDED: [],
            PLAYER_DIED: [],
            PLAYER_REVIVED: [],
            PLAYER_CONNECTED: [],    // Track player connections
            PLAYER_DISCONNECTED: []  // Track player disconnections
        };

        // Timestamps for each buffer's last flush
        this.lastFlush = {
            PLAYER_DAMAGED: Date.now(),
            PLAYER_WOUNDED: Date.now(),
            PLAYER_DIED: Date.now(),
            PLAYER_REVIVED: Date.now(),
            PLAYER_CONNECTED: Date.now(),
            PLAYER_DISCONNECTED: Date.now()
        };

        // Track retry attempts and delays for each event type
        this.retryDelays = {};
        this.retryCounts = {};

        // Ensure dead letter queue directory exists
        this.initializeDeadLetterQueue();

        // Start the flush interval
        this.startFlushInterval();
    }

    async initializeDeadLetterQueue() {
        try {
            await fs.mkdir(this.options.deadLetterPath, { recursive: true });
            logger.info('Dead letter queue directory initialized');
        } catch (error) {
            logger.error('Failed to initialize dead letter queue directory:', error);
        }
    }

    async writeToDeadLetterQueue(eventType, events) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${eventType}_${timestamp}.json`;
        const filepath = path.join(this.options.deadLetterPath, filename);

        try {
            const data = {
                eventType,
                timestamp: new Date().toISOString(),
                count: events.length,
                events
            };
            await fs.writeFile(filepath, JSON.stringify(data, null, 2));
            logger.warn(`Wrote ${events.length} failed ${eventType} events to dead letter queue: ${filename}`);
        } catch (error) {
            logger.error(`Failed to write to dead letter queue: ${filename}`, error);
        }
    }

    addEvent(event) {
        if (!event || !event.event || !this.buffers[event.event]) {
            logger.debug('Untracked event received:', event.event);
            return;
        }

        const buffer = this.buffers[event.event];
        buffer.push(event);

        // Check if we need to force a flush due to buffer size
        if (buffer.length >= this.options.maxBufferSize) {
            logger.debug(`Buffer for ${event.event} reached max size, forcing flush`);
            this.flushBuffer(event.event);
        }

        // Check if we need to force a flush due to event age
        const oldestEvent = buffer[0];
        if (oldestEvent && (Date.now() - new Date(oldestEvent.timestamp).getTime() > this.options.maxAge)) {
            logger.debug(`Oldest event in ${event.event} buffer exceeded max age, forcing flush`);
            this.flushBuffer(event.event);
        }
    }

    async flushBuffer(eventType) {
        const buffer = this.buffers[eventType];
        if (buffer.length === 0) return;

        const eventsToProcess = [...buffer];
        buffer.length = 0; // Clear the buffer
        this.lastFlush[eventType] = Date.now();

        const transaction = await sequelize.transaction();
        try {
            let result;
            switch (eventType) {
                case 'PLAYER_DAMAGED':
                    result = await PlayerDamage.bulkCreateFromSquadEvents(eventsToProcess, { transaction });
                    break;
                case 'PLAYER_WOUNDED':
                    result = await PlayerWound.bulkCreateFromSquadEvents(eventsToProcess, { transaction });
                    break;
                case 'PLAYER_DIED':
                    result = await PlayerDeath.bulkCreateFromSquadEvents(eventsToProcess, { transaction });
                    break;
                case 'PLAYER_REVIVED':
                    result = await PlayerRevive.bulkCreateFromSquadEvents(eventsToProcess, { transaction });
                    break;
                case 'PLAYER_CONNECTED':
                    result = await this.handlePlayerConnections(eventsToProcess, transaction);
                    break;
                case 'PLAYER_DISCONNECTED':
                    result = await this.handlePlayerDisconnections(eventsToProcess, transaction);
                    break;
            }

            await transaction.commit();

            if (result) {
                logger.debug(`Flushed ${result.successful} ${eventType} events to database`);
                if (result.failed > 0) {
                    logger.warn(`Failed to process ${result.failed} ${eventType} events:`, result.errors);
                }
            }

            // Reset retry counters on successful flush
            this.retryCounts[eventType] = 0;
            this.retryDelays[eventType] = 0;

        } catch (error) {
            await transaction.rollback();
            logger.error(`Error flushing ${eventType} buffer:`, error);

            // Put the events back in the buffer BEFORE scheduling retry
            buffer.unshift(...eventsToProcess);

            // Implement exponential backoff for retries
            const retryCount = (this.retryCounts[eventType] || 0) + 1;
            this.retryCounts[eventType] = retryCount;

            if (retryCount <= this.options.maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 30000); // Max 30s
                logger.info(`Scheduling retry for ${eventType} in ${delay}ms (attempt ${retryCount}/${this.options.maxRetries})`);
                setTimeout(() => this.flushBuffer(eventType), delay);
            } else {
                // Move to dead letter queue after max retries
                logger.error(`Max retries (${this.options.maxRetries}) reached for ${eventType}, moving to dead letter queue`);
                await this.writeToDeadLetterQueue(eventType, eventsToProcess);
                buffer.length = 0; // Clear buffer since we moved to dead letter queue
            }
        }
    }

    async handlePlayerConnections(events, transaction) {
        const results = {
            successful: 0,
            failed: 0,
            errors: []
        };

        for (const event of events) {
            try {
                const player = event.data?.player || {};
                const steamID = player.steamID;
                const eosID = player.eosID;
                const name = player.name;
                if (!steamID && !eosID) {
                    throw new Error('Player must have either steamID or eosID');
                }

                // Try to find existing player by steamID or eosID
                const [playerRecord, created] = await Player.findOrCreate({
                    where: {
                        [sequelize.Op.or]: [
                            { steamID: steamID || null },
                            { eosID: eosID || null }
                        ]
                    },
                    defaults: {
                        steamID: steamID || null,
                        eosID: eosID || null,
                        lastKnownName: name,
                        firstSeen: new Date(),
                        isActive: true
                    },
                    transaction
                });

                if (!created) {
                    // Update existing player
                    await playerRecord.update({
                        lastKnownName: name,
                        isActive: true,
                        lastSeen: new Date()
                    }, { transaction });
                }

                results.successful++;
            } catch (error) {
                results.failed++;
                results.errors.push({
                    event,
                    error: error.message
                });
                logger.error('Error processing player connection:', error);
            }
        }

        return results;
    }

    async handlePlayerDisconnections(events, transaction) {
        const results = {
            successful: 0,
            failed: 0,
            errors: []
        };

        for (const event of events) {
            try {
                const player = event.data?.player || {};
                const steamID = player.steamID;
                const eosID = player.eosID;
                if (!steamID && !eosID) {
                    throw new Error('Player must have either steamID or eosID');
                }

                // Find player by steamID or eosID
                const playerRecord = await Player.findOne({
                    where: {
                        [sequelize.Op.or]: [
                            { steamID: steamID || null },
                            { eosID: eosID || null }
                        ]
                    },
                    transaction
                });

                if (playerRecord) {
                    await playerRecord.update({
                        isActive: false,
                        lastSeen: new Date()
                    }, { transaction });
                    results.successful++;
                } else {
                    logger.warn(`Player not found for disconnection event:`, { steamID, eosID });
                    results.failed++;
                    results.errors.push({
                        event,
                        error: 'Player not found'
                    });
                }
            } catch (error) {
                results.failed++;
                results.errors.push({
                    event,
                    error: error.message
                });
                logger.error('Error processing player disconnection:', error);
            }
        }

        return results;
    }

    startFlushInterval() {
        this.flushInterval = setInterval(() => {
            const now = Date.now();
            Object.keys(this.buffers).forEach(eventType => {
                // Flush if enough time has passed since last flush
                if (now - this.lastFlush[eventType] >= this.options.flushInterval) {
                    this.flushBuffer(eventType);
                }
            });
        }, this.options.flushInterval);
    }

    stopFlushInterval() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }
    }

    // Force flush all buffers (useful during shutdown)
    async flushAll() {
        logger.info('Flushing all event buffers...');
        const flushPromises = Object.keys(this.buffers).map(eventType => 
            this.flushBuffer(eventType)
        );
        await Promise.all(flushPromises);
        logger.info('All event buffers flushed');
    }

    // Get current buffer sizes for monitoring
    getBufferSizes() {
        return Object.fromEntries(
            Object.entries(this.buffers).map(([type, buffer]) => [type, buffer.length])
        );
    }
}

module.exports = EventBuffer; 