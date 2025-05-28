const logger = require('./logger');
const fs = require('fs').promises;
const path = require('path');
const { PlayerDamage, PlayerWound, PlayerDeath, PlayerRevive, Player, sequelize } = require('../database/models');
const { Op } = require('sequelize');

// Helper function to sanitize player names
function sanitizePlayerName(name) {
    if (!name) return null;
    
    // Truncate to 50 characters (database limit)
    let sanitized = name.slice(0, 50);
    
    // Remove control characters and other problematic Unicode
    sanitized = sanitized.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    
    // Replace zero-width characters
    sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF]/g, '');
    
    // Replace invalid surrogate pairs
    sanitized = sanitized.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]?/g, '');
    
    // If the name is empty after sanitization, return null
    return sanitized.trim() || null;
}

// Helper function to extract player data from event
function extractPlayerData(event) {
    const result = {
        steamID: null,
        eosID: null,
        name: null,
        timestamp: event.timestamp ? new Date(event.timestamp) : new Date()
    };

    // Try to get data from player object first
    const player = event.data?.player;
    if (player) {
        result.steamID = player.steamID;
        result.eosID = player.eosID;
        result.name = sanitizePlayerName(player.name);
    }

    // If no IDs found, try to extract from raw log
    if ((!result.steamID && !result.eosID) && event.data?.raw) {
        const rawLog = event.data.raw;
        
        // Try to extract EOS ID - handles both formats:
        // 1. "UniqueId: RedpointEOS:0002d7d5d9bb4ebc811716ee243201a3"
        // 2. "UniqueId: 0002d7d5d9bb4ebc811716ee243201a3"
        const eosMatch = rawLog.match(/UniqueId:\s*(?:RedpointEOS:)?([a-f0-9]{32})/i);
        if (eosMatch) {
            result.eosID = eosMatch[1]; // Just the hex part
        }

        // Try to extract Steam ID
        const steamMatch = rawLog.match(/SteamID:\s*(\d+)/i);
        if (steamMatch) {
            result.steamID = steamMatch[1];
        }

        // Try to extract player name
        const nameMatch = rawLog.match(/Name:\s*([^\n]+)/i);
        if (nameMatch) {
            result.name = sanitizePlayerName(nameMatch[1].trim());
        }
    }

    return result;
}

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
            PLAYER_DISCONNECTED: [], // Track player disconnections
            PLAYER_CHAT: []          // Track chat messages for verification
        };

        // Timestamps for each buffer's last flush
        this.lastFlush = {
            PLAYER_DAMAGED: Date.now(),
            PLAYER_WOUNDED: Date.now(),
            PLAYER_DIED: Date.now(),
            PLAYER_REVIVED: Date.now(),
            PLAYER_CONNECTED: Date.now(),
            PLAYER_DISCONNECTED: Date.now(),
            PLAYER_CHAT: Date.now()
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

    async writeToDeadLetterQueue(eventType, data) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${eventType}_${timestamp}.json`;
        const filepath = path.join(this.options.deadLetterPath, filename);

        try {
            const deadLetterEntry = {
                eventType,
                timestamp: new Date().toISOString(),
                count: data.events.length,
                events: data.events,
                error: data.error
            };
            await fs.writeFile(filepath, JSON.stringify(deadLetterEntry, null, 2));
            logger.warn(`Wrote ${data.events.length} failed ${eventType} events to dead letter queue: ${filename}`);
        } catch (error) {
            logger.error(`Failed to write to dead letter queue: ${filename}`, error);
            throw error; // Re-throw to handle in the caller
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

        // Process events in smaller batches to prevent transaction timeouts
        const BATCH_SIZE = 50;
        const results = {
            successful: 0,
            failed: 0,
            created: 0,
            errors: []
        };

        for (let i = 0; i < eventsToProcess.length; i += BATCH_SIZE) {
            const batch = eventsToProcess.slice(i, i + BATCH_SIZE);
            const transaction = await sequelize.transaction();

            try {
                let batchResult;
                switch (eventType) {
                    case 'PLAYER_DAMAGED':
                        batchResult = await PlayerDamage.bulkCreateFromSquadEvents(batch, { transaction });
                        break;
                    case 'PLAYER_WOUNDED':
                        batchResult = await PlayerWound.bulkCreateFromSquadEvents(batch, { transaction });
                        break;
                    case 'PLAYER_DIED':
                        batchResult = await PlayerDeath.bulkCreateFromSquadEvents(batch, { transaction });
                        break;
                    case 'PLAYER_REVIVED':
                        batchResult = await PlayerRevive.bulkCreateFromSquadEvents(batch, { transaction });
                        break;
                    case 'PLAYER_CONNECTED':
                        batchResult = await this.handlePlayerConnections(batch, transaction);
                        break;
                    case 'PLAYER_DISCONNECTED':
                        batchResult = await this.handlePlayerDisconnections(batch, transaction);
                        break;
                    case 'PLAYER_CHAT':
                        // Chat events are handled in real-time
                        batchResult = { successful: batch.length, failed: 0, errors: [] };
                        break;
                }

                await transaction.commit();

                // Aggregate results
                if (batchResult) {
                    results.successful += batchResult.successful || 0;
                    results.failed += batchResult.failed || 0;
                    results.created += batchResult.created || 0;
                    if (batchResult.errors) {
                        results.errors.push(...batchResult.errors);
                    }
                }

                // Reset retry counters on successful batch
                this.retryCounts[eventType] = 0;
                this.retryDelays[eventType] = 0;

            } catch (error) {
                await transaction.rollback();
                logger.error(`Error processing batch of ${eventType} events:`, error);

                // Handle retries for this batch
                this.retryCounts[eventType] = (this.retryCounts[eventType] || 0) + 1;
                if (this.retryCounts[eventType] <= this.options.maxRetries) {
                    // Exponential backoff
                    this.retryDelays[eventType] = Math.min(30000, 1000 * Math.pow(2, this.retryCounts[eventType]));
                    logger.info(`Scheduling retry for batch of ${eventType} in ${this.retryDelays[eventType]/1000} seconds`);
                    
                    // Put batch back in buffer
                    buffer.push(...batch);
                    
                    // Schedule retry
                    setTimeout(() => this.flushBuffer(eventType), this.retryDelays[eventType]);
                } else {
                    // Move failed batch to dead letter queue with error information
                    const deadLetterData = {
                        events: batch,
                        error: {
                            message: error.message,
                            stack: error.stack,
                            code: error.code,
                            retryCount: this.retryCounts[eventType],
                            lastAttempt: new Date().toISOString()
                        }
                    };
                    
                    try {
                        await this.writeToDeadLetterQueue(eventType, deadLetterData);
                        logger.warn(`Moved ${batch.length} failed ${eventType} events to dead letter queue after ${this.retryCounts[eventType]} retries`, {
                            error: error.message,
                            batchSize: batch.length,
                            serverID: batch[0]?.serverID,
                            timestamp: batch[0]?.timestamp
                        });
                    } catch (dlqError) {
                        logger.error(`Failed to write to dead letter queue for ${eventType}:`, {
                            error: dlqError.message,
                            originalError: error.message,
                            batchSize: batch.length
                        });
                    }
                    
                    results.failed += batch.length;
                    results.errors.push({
                        batch,
                        error: error.message,
                        retryCount: this.retryCounts[eventType]
                    });
                }
            }
        }

        // Log summary of the flush operation
        if (results.failed > 0 || results.created > 0) {
            logger.info(`${eventType} flush summary:`, {
                total: eventsToProcess.length,
                successful: results.successful,
                failed: results.failed,
                created: results.created,
                serverID: eventsToProcess[0]?.serverID,
                timestamp: eventsToProcess[0]?.timestamp
            });
        }

        return results;
    }

    async handlePlayerConnections(events, transaction) {
        const results = {
            successful: 0,
            failed: 0,
            created: 0,
            errors: []
        };

        for (const event of events) {
            try {
                const playerData = extractPlayerData(event);
                
                if (!playerData.steamID && !playerData.eosID) {
                    throw new Error('Player must have either steamID or eosID');
                }

                // Try to find existing player by steamID or eosID
                const [playerRecord, created] = await Player.findOrCreate({
                    where: {
                        [Op.or]: [
                            { steamID: playerData.steamID || null },
                            { eosID: playerData.eosID || null }
                        ]
                    },
                    defaults: {
                        steamID: playerData.steamID || null,
                        eosID: playerData.eosID || null,
                        lastKnownName: playerData.name,
                        firstSeen: playerData.timestamp,
                        isActive: true,
                        lastSeen: playerData.timestamp
                    },
                    transaction
                });

                if (created) {
                    results.created++;
                }

                // Update existing player
                if (!created || playerData.name) {
                    await playerRecord.update({
                        lastKnownName: playerData.name,
                        isActive: true,
                        lastSeen: playerData.timestamp
                    }, { transaction });
                }

                results.successful++;
            } catch (error) {
                results.failed++;
                results.errors.push({
                    event,
                    error: error.message
                });
                logger.error('Error processing player connection:', {
                    error: error.message,
                    event: event.event,
                    serverID: event.serverID,
                    timestamp: event.timestamp
                });
            }
        }

        return results;
    }

    async handlePlayerDisconnections(events, transaction) {
        const results = {
            successful: 0,
            failed: 0,
            created: 0,
            errors: []
        };

        for (const event of events) {
            try {
                const playerData = extractPlayerData(event);

                // If we still don't have any player identification, log and skip
                if (!playerData.steamID && !playerData.eosID) {
                    logger.warn('Could not extract player identification from disconnection event', {
                        event: event.event,
                        serverID: event.serverID,
                        timestamp: event.timestamp,
                        rawData: event.data
                    });
                    results.failed++;
                    results.errors.push({
                        event,
                        error: 'No player identification found in event data'
                    });
                    continue;
                }

                // Try to find existing player record
                let playerRecord = await Player.findOne({
                    where: {
                        [Op.or]: [
                            { steamID: playerData.steamID || null },
                            { eosID: playerData.eosID || null }
                        ]
                    },
                    transaction
                });

                // If player not found and we have enough data, create a new record
                if (!playerRecord && (playerData.steamID || playerData.eosID)) {
                    try {
                        playerRecord = await Player.create({
                            steamID: playerData.steamID || null,
                            eosID: playerData.eosID || null,
                            lastKnownName: playerData.name,
                            firstSeen: playerData.timestamp,
                            isActive: false, // Set to false since they're disconnecting
                            lastSeen: playerData.timestamp
                        }, { transaction });
                        
                        results.created++;
                        logger.info('Created missing player record during disconnection', {
                            steamID: playerData.steamID,
                            eosID: playerData.eosID,
                            playerID: playerRecord.id,
                            serverID: event.serverID,
                            timestamp: event.timestamp
                        });
                    } catch (createError) {
                        logger.error('Failed to create missing player record during disconnection', {
                            error: createError.message,
                            steamID: playerData.steamID,
                            eosID: playerData.eosID,
                            serverID: event.serverID,
                            timestamp: event.timestamp
                        });
                        // Don't increment failed count here - we'll try to continue with the update
                    }
                }

                // Update player record if we have one (either found or created)
                if (playerRecord) {
                    try {
                        await playerRecord.update({
                            isActive: false,
                            lastSeen: playerData.timestamp,
                            // Only update name if we have one and it's different
                            ...(playerData.name && playerRecord.lastKnownName !== playerData.name && {
                                lastKnownName: playerData.name
                            })
                        }, { transaction });
                        
                        results.successful++;
                        logger.debug('Updated player disconnection status', {
                            steamID: playerData.steamID,
                            eosID: playerData.eosID,
                            playerID: playerRecord.id,
                            serverID: event.serverID,
                            timestamp: event.timestamp
                        });
                    } catch (updateError) {
                        logger.error('Failed to update player record during disconnection', {
                            error: updateError.message,
                            steamID: playerData.steamID,
                            eosID: playerData.eosID,
                            playerID: playerRecord.id,
                            serverID: event.serverID,
                            timestamp: event.timestamp
                        });
                        results.failed++;
                        results.errors.push({
                            event,
                            error: `Update failed: ${updateError.message}`
                        });
                    }
                } else {
                    // If we couldn't find or create a player record
                    logger.warn('Could not find or create player record for disconnection', {
                        steamID: playerData.steamID,
                        eosID: playerData.eosID,
                        serverID: event.serverID,
                        timestamp: event.timestamp
                    });
                    results.failed++;
                    results.errors.push({
                        event,
                        error: 'Could not find or create player record'
                    });
                }
            } catch (error) {
                results.failed++;
                results.errors.push({
                    event,
                    error: error.message
                });
                logger.error('Error processing player disconnection', {
                    error: error.message,
                    event: event.event,
                    serverID: event.serverID,
                    timestamp: event.timestamp
                });
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