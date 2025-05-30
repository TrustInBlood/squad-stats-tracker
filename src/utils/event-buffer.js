// /home/richie/modding/squad-stats-tracker/src/utils/event-buffer.js
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const { sequelize } = require('../database/models');
const { upsertPlayer } = require('./player-utils');

class EventBuffer {
  constructor(options = {}) {
    this.options = {
      flushInterval: options.flushInterval || 5000,
      maxBufferSize: options.maxBufferSize || 100,
      maxAge: options.maxAge || 10000,
      maxRetries: options.maxRetries || 3,
      deadLetterPath: options.deadLetterPath || path.join(process.cwd(), 'logs', 'dead-letter'),
    };

    this.buffers = {
      PLAYER_DAMAGED: [],
      PLAYER_WOUNDED: [],
      PLAYER_DIED: [],
      PLAYER_REVIVED: [],
      CHAT_MESSAGE: [],
      PLAYER_CONNECTED: [],
      PLAYER_DISCONNECTED: [],
    };

    this.lastFlush = {
      PLAYER_DAMAGED: Date.now(),
      PLAYER_WOUNDED: Date.now(),
      PLAYER_DIED: Date.now(),
      PLAYER_REVIVED: Date.now(),
      CHAT_MESSAGE: Date.now(),
      PLAYER_CONNECTED: Date.now(),
      PLAYER_DISCONNECTED: Date.now(),
    };

    this.retryDelays = {};
    this.retryCounts = {};

    this.initializeDeadLetterQueue();
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
        error: data.error,
      };
      await fs.writeFile(filepath, JSON.stringify(deadLetterEntry, null, 2));
      logger.warn(`Wrote ${data.events.length} failed ${eventType} events to dead letter queue: ${filename}`);
    } catch (error) {
      logger.error(`Failed to write to dead letter queue: ${filename}`, error);
      throw error;
    }
  }

  addEvent(event) {
    if (!event || !event.event || !this.buffers[event.event]) {
      return;
    }

    const buffer = this.buffers[event.event];
    buffer.push(event);

    if (buffer.length >= this.options.maxBufferSize) {
      logger.debug(`Buffer for ${event.event} reached max size, forcing flush`);
      this.flushBuffer(event.event);
    }

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
    buffer.length = 0;
    this.lastFlush[eventType] = Date.now();

    const results = {
      successful: 0,
      failed: 0,
      created: 0,
      errors: [],
    };

    try {
      for (const event of eventsToProcess) {
        const transaction = await sequelize.transaction();
        try {
          let batchResult;
          switch (eventType) {
            case 'CHAT_MESSAGE':
              batchResult = await this.handleChatMessage([event], transaction);
              break;
            case 'PLAYER_DAMAGED':
              batchResult = await this.handlePlayerDamaged([event], transaction);
              break;
            case 'PLAYER_WOUNDED':
              batchResult = await this.handlePlayerWounded([event], transaction);
              break;
            case 'PLAYER_DIED':
              batchResult = await this.handlePlayerDied([event], transaction);
              break;
            case 'PLAYER_REVIVED':
              batchResult = await this.handlePlayerRevived([event], transaction);
              break;
            case 'PLAYER_CONNECTED':
              batchResult = await this.handlePlayerConnected([event], transaction);
              break;
            case 'PLAYER_DISCONNECTED':
              batchResult = await this.handlePlayerDisconnected([event], transaction);
              break;
            default:
              batchResult = { successful: 1, failed: 0, created: 0, errors: [] };
              break;
          }

          await transaction.commit();

          if (batchResult) {
            results.successful += batchResult.successful || 0;
            results.failed += batchResult.failed || 0;
            results.created += batchResult.created || 0;
            if (batchResult.errors) results.errors.push(...batchResult.errors);
          }
        } catch (error) {
          await transaction.rollback();
          logger.error(`Error processing event of type ${eventType}:`, {
            error: error.message,
            event,
          });

          this.retryCounts[eventType] = (this.retryCounts[eventType] || 0) + 1;
          if (this.retryCounts[eventType] <= this.options.maxRetries) {
            this.retryDelays[eventType] = Math.min(30000, 1000 * Math.pow(2, this.retryCounts[eventType]));
            logger.info(`Scheduling retry for event of type ${eventType} in ${this.retryDelays[eventType]/1000} seconds`);
            buffer.push(event);
            setTimeout(() => this.flushBuffer(eventType), this.retryDelays[eventType]);
          } else {
            const deadLetterData = {
              events: [event],
              error: {
                message: error.message,
                stack: error.stack,
                code: error.code,
                retryCount: this.retryCounts[eventType],
                lastAttempt: new Date().toISOString(),
              },
            };
            try {
              await this.writeToDeadLetterQueue(eventType, deadLetterData);
              logger.warn(`Moved failed ${eventType} event to dead letter queue after ${this.retryCounts[eventType]} retries`, {
                error: error.message,
                serverID: event?.serverID,
                timestamp: event?.timestamp,
              });
            } catch (dlqError) {
              logger.error(`Failed to write to dead letter queue for ${eventType}:`, {
                error: dlqError.message,
                originalError: error.message,
              });
            }
            results.failed++;
            results.errors.push({ event, error: error.message, retryCount: this.retryCounts[eventType] });
          }
        }
      }

      this.retryCounts[eventType] = 0;
      this.retryDelays[eventType] = 0;
    } catch (error) {
      logger.error(`Unexpected error in flushBuffer for ${eventType}:`, error);
      results.failed += eventsToProcess.length;
      results.errors.push({ events: eventsToProcess, error: error.message });
    }

    if (results.failed > 0 || results.created > 0) {
      logger.info(`${eventType} flush summary:`, {
        total: eventsToProcess.length,
        successful: results.successful,
        failed: results.failed,
        created: results.created,
        serverID: eventsToProcess[0]?.serverID,
        timestamp: eventsToProcess[0]?.timestamp,
      });
    }

    return results;
  }

  async handleChatMessage(events, transaction) {
    const results = { successful: 0, failed: 0, created: 0, errors: [] };
    for (const event of events) {
      try {
        const playerIds = await upsertPlayer(event, transaction);
        if (!playerIds || playerIds.length === 0) {
          logger.warn('No players upserted for CHAT_MESSAGE', { event });
          continue;
        }
        results.successful++;
        results.created += playerIds.length;
        logger.info('Upserted players', { playerIds });
      } catch (error) {
        results.failed++;
        results.errors.push({ event, error: error.message });
        logger.error('Error processing CHAT_MESSAGE:', { error: error.message, event });
        throw error;
      }
    }
    return results;
  }

  async handlePlayerDamaged(events, transaction) {
    const results = { successful: 0, failed: 0, created: 0, errors: [] };
    for (const event of events) {
      try {
        const playerIds = await upsertPlayer(event, transaction);
        if (!playerIds || playerIds.length === 0) {
          logger.warn('No players upserted for PLAYER_DAMAGED', { event });
          continue;
        }
        results.successful++;
        results.created += playerIds.length;
        logger.info('Upserted players', { playerIds });
      } catch (error) {
        results.failed++;
        results.errors.push({ event, error: error.message });
        logger.error('Error processing PLAYER_DAMAGED:', { error: error.message, event });
        throw error;
      }
    }
    return results;
  }

  async handlePlayerWounded(events, transaction) {
    const results = { successful: 0, failed: 0, created: 0, errors: [] };
    for (const event of events) {
      try {
        const playerIds = await upsertPlayer(event, transaction);
        if (!playerIds || playerIds.length === 0) {
          logger.warn('No players upserted for PLAYER_WOUNDED', { event });
          continue;
        }
        results.successful++;
        results.created += playerIds.length;
        logger.info('Upserted players', { playerIds });
      } catch (error) {
        results.failed++;
        results.errors.push({ event, error: error.message });
        logger.error('Error processing PLAYER_WOUNDED:', { error: error.message, event });
        throw error;
      }
    }
    return results;
  }

  async handlePlayerDied(events, transaction) {
    const results = { successful: 0, failed: 0, created: 0, errors: [] };
    for (const event of events) {
      try {
        const playerIds = await upsertPlayer(event, transaction);
        if (!playerIds || playerIds.length === 0) {
          logger.warn('No players upserted for PLAYER_DIED', { event });
          continue;
        }
        results.successful++;
        results.created += playerIds.length;
        logger.info('Upserted players', { playerIds });
      } catch (error) {
        results.failed++;
        results.errors.push({ event, error: error.message });
        logger.error('Error processing PLAYER_DIED:', { error: error.message, event });
        throw error;
      }
    }
    return results;
  }

  async handlePlayerRevived(events, transaction) {
    const results = { successful: 0, failed: 0, created: 0, errors: [] };
    for (const event of events) {
      try {
        const playerIds = await upsertPlayer(event, transaction);
        if (!playerIds || playerIds.length === 0) {
          logger.warn('No players upserted for PLAYER_REVIVED', { event });
          continue;
        }
        results.successful++;
        results.created += playerIds.length;
        logger.info('Upserted players', { playerIds });
      } catch (error) {
        results.failed++;
        results.errors.push({ event, error: error.message });
        logger.error('Error processing PLAYER_REVIVED:', { error: error.message, event });
        throw error;
      }
    }
    return results;
  }

  async handlePlayerConnected(events, transaction) {
    const results = { successful: 0, failed: 0, created: 0, errors: [] };
    for (const event of events) {
      try {
        const playerIds = await upsertPlayer(event, transaction);
        if (!playerIds || playerIds.length === 0) {
          logger.warn('No players upserted for PLAYER_CONNECTED', { event });
          continue;
        }
        results.successful++;
        results.created += playerIds.length;
        logger.info('Upserted players', { playerIds });
      } catch (error) {
        results.failed++;
        results.errors.push({ event, error: error.message });
        logger.error('Error processing PLAYER_CONNECTED:', { error: error.message, event });
        throw error;
      }
    }
    return results;
  }

  async handlePlayerDisconnected(events, transaction) {
    const results = { successful: 0, failed: 0, created: 0, errors: [] };
    for (const event of events) {
      try {
        const playerIds = await upsertPlayer(event, transaction);
        if (!playerIds || playerIds.length === 0) {
          logger.warn('No players upserted for PLAYER_DISCONNECTED', { event });
          continue;
        }
        results.successful++;
        results.created += playerIds.length;
        logger.info('Upserted players', { playerIds });
      } catch (error) {
        results.failed++;
        results.errors.push({ event, error: error.message });
        logger.error('Error processing PLAYER_DISCONNECTED:', { error: error.message, event });
        throw error;
      }
    }
    return results;
  }

  startFlushInterval() {
    this.flushInterval = setInterval(() => {
      const now = Date.now();
      Object.keys(this.buffers).forEach(eventType => {
        if (now - this.lastFlush[eventType] >= this.options.flushInterval) {
          this.flushBuffer(eventType);
        }
      });
    }, this.options.flushInterval);
  }

  stopFlushInterval() {
    if (this.flushInterval) clearInterval(this.flushInterval);
  }

  async flushAll() {
    logger.info('Flushing all event buffers...');
    for (const eventType of Object.keys(this.buffers)) {
      await this.flushBuffer(eventType);
    }
    logger.info('All event buffers flushed');
  }

  getBufferSizes() {
    return Object.fromEntries(
      Object.entries(this.buffers).map(([type, buffer]) => [type, buffer.length])
    );
  }
}

module.exports = EventBuffer;