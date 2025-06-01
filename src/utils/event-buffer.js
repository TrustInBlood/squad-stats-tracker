const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const { sequelize, Sequelize } = require('../database/models'); // Keep only sequelize and Sequelize
const { Op } = require('sequelize');
const { upsertPlayer } = require('./player-utils');
const { getWeaponId } = require('./weapon-utils');

class EventBuffer {
  constructor(options = {}, client) {
    this.options = {
      flushInterval: options.flushInterval || 5000,
      maxBufferSize: options.maxBufferSize || 100,
      maxAge: options.maxAge || 10000,
      maxRetries: options.maxRetries || 3,
      deadLetterPath: options.deadLetterPath || path.join(process.cwd(), 'logs', 'dead-letter'),
      deathDelay: options.deathDelay || 10000,
    };
    this.client = client; // Store the client instance

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

    if (event.event === 'PLAYER_DIED') {
      const now = Date.now();
      const eventTime = new Date(event.timestamp).getTime();
      if (now - eventTime < this.options.deathDelay) {
        return;
      }
    }

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

    const now = Date.now();
    const eventsToProcess = eventType === 'PLAYER_DIED'
      ? buffer.filter(event => now - new Date(event.timestamp).getTime() >= this.options.deathDelay)
      : [...buffer];

    if (eventType === 'PLAYER_DIED') {
      this.buffers[eventType] = buffer.filter(event => now - new Date(event.timestamp).getTime() < this.options.deathDelay);
    } else {
      buffer.length = 0;
    }

    if (eventsToProcess.length === 0) return;

    this.lastFlush[eventType] = Date.now();

    const results = {
      successful: 0,
      failed: 0,
      created: 0,
      errors: [],
    };

    try {
      for (const event of eventsToProcess) {
        const transaction = await sequelize.transaction({ timeout: 5000 });
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
            event: JSON.stringify(event),
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
  
        const playerId = playerIds[0];
        const message = event.data.message || '';
        const match = message.match(/^!link\s+(\w{6})$/i);
        if (!match) {
          results.successful++;
          results.created += playerIds.length;
          continue;
        }
  
        const code = match[1].toUpperCase();
        const verification = await sequelize.models.VerificationCode.findOne({
          where: { code, expires_at: { [Op.gt]: new Date() } },
          transaction
        });
  
        if (!verification) {
          logger.info(`Invalid or expired verification code: ${code}`);
          results.successful++;
          results.created += playerIds.length;
          continue;
        }
  
        const discordId = verification.discord_id;
        await sequelize.models.PlayerDiscordLink.destroy({ where: { player_id: playerId }, transaction }); // Ensure one link per player_id
        await sequelize.models.PlayerDiscordLink.create({
          player_id: playerId,
          discord_id: discordId,
          linked_at: new Date()
        }, { transaction });
  
        // After successful link, update the original ephemeral message if possible
        if (verification.interaction_token && verification.application_id) {
          try {
            const { editOriginalInteractionResponse } = require('./discord-webhook');
            const embed = {
              title: 'Link Successful!',
              description: 'Your Squad account has been successfully linked to your Discord account.',
              color: 0x57F287, // Discord green
              fields: [
                { name: 'What happens next?', value: 'You can now use all Squad Stats features linked to your Discord account.' }
              ],
              footer: { text: 'If you have any issues, contact a server admin.' }
            };
            await editOriginalInteractionResponse(
              verification.application_id,
              verification.interaction_token,
              null,
              embed
            );
          } catch (err) {
            logger.error('Failed to update original ephemeral message via webhook:', err);
          }
        }
        
        await verification.destroy({ transaction });
  
        results.successful++;
        results.created += playerIds.length;
        logger.info('Linked player to Discord', { playerId, discordId });
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
        const weaponId = await getWeaponId(event.data.weapon, transaction);
        logger.info('Weapon processed', { weapon: event.data.weapon, weaponId });

        const playerIds = await upsertPlayer(event, transaction);
        if (!playerIds || playerIds.length === 0) {
          logger.warn('No players upserted for PLAYER_WOUNDED', { event: JSON.stringify(event) });
          continue;
        }

        const attackerId = event.data.attacker ? playerIds[0] : null;
        const victimId = event.data.victim ? playerIds[event.data.attacker ? 1 : 0] : null;

        await sequelize.models.PlayerWounded.create({
          server_id: event.serverID,
          attacker_id: attackerId,
          victim_id: victimId,
          weapon_id: weaponId,
          damage: event.data.damage,
          teamkill: event.data.teamkill ?? false,
          attacker_squad_id: event.data.attacker?.squad?.squadID,
          victim_squad_id: event.data.victim?.squad?.squadID,
          attacker_team_id: event.data.attacker?.squad?.teamID,
          victim_team_id: event.data.victim?.squad?.teamID,
          timestamp: new Date(event.timestamp),
          created_at: new Date(),
          updated_at: new Date()
        }, { transaction });

        results.successful++;
        results.created += playerIds.length;
        logger.info('Upserted players and logged event', { playerIds, eventType: 'PLAYER_WOUNDED' });
      } catch (error) {
        results.failed++;
        results.errors.push({ event, error: error.message });
        logger.error('Error processing PLAYER_WOUNDED:', { error: error.message, event: JSON.stringify(event) });
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
          logger.warn('No players upserted for PLAYER_DIED', { event: JSON.stringify(event) });
          continue;
        }

        const attackerId = event.data.attacker ? playerIds[0] : null;
        const victimId = event.data.victim ? playerIds[event.data.attacker ? 1 : 0] : null;

        if (!victimId) {
          logger.warn('Skipping PLAYER_DIED with invalid victim', { event: JSON.stringify(event) });
          continue;
        }

        // Try to find the weapon_id, but proceed even if not found
        const [woundingEvent] = await sequelize.query(`
          SELECT weapon_id
          FROM player_wounded
          WHERE victim_id = :victimId
            AND timestamp <= :time
          ORDER BY timestamp DESC
          LIMIT 1
        `, {
          replacements: { victimId, time: event.timestamp },
          type: sequelize.QueryTypes.SELECT,
          transaction
        });

        const weaponId = woundingEvent?.weapon_id || null;
        if (!weaponId) {
          logger.warn(`No matching PLAYER_WOUNDED found for PLAYER_DIED (victimId: ${victimId}), proceeding with weapon_id as NULL`);
        }

        await sequelize.models.Kill.create({
          server_id: event.serverID,
          attacker_id: attackerId,
          victim_id: victimId,
          weapon_id: weaponId,
          teamkill: event.data.teamkill ?? false,
          timestamp: new Date(event.timestamp),
          created_at: new Date(),
          updated_at: new Date()
        }, { transaction });

        results.successful++;
        results.created += playerIds.length;
        logger.info('Upserted players and logged kill', { playerIds, eventType: 'PLAYER_DIED', attackerId, victimId, weaponId });
      } catch (error) {
        results.failed++;
        results.errors.push({ event, error: error.message });
        logger.error('Error processing PLAYER_DIED:', { error: error.message, event: JSON.stringify(event) });
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
          logger.warn('No players upserted for PLAYER_REVIVED', { event: JSON.stringify(event) });
          continue;
        }
  
        const reviverId = event.data.reviver ? playerIds[0] : null;
        const victimId = event.data.victim ? playerIds[event.data.reviver ? 1 : 0] : null;
  
        if (!victimId || !reviverId) {
          logger.warn('Skipping PLAYER_REVIVED with invalid reviver or victim', { event: JSON.stringify(event) });
          continue;
        }
  
        await sequelize.models.Revive.create({
          server_id: event.serverID,
          reviver_id: reviverId,
          victim_id: victimId,
          timestamp: new Date(event.timestamp),
          created_at: new Date(),
          updated_at: new Date()
        }, { transaction });
  
        results.successful++;
        results.created += playerIds.length;
        logger.info('Upserted players and logged revive', { playerIds, eventType: 'PLAYER_REVIVED', reviverId, victimId });
      } catch (error) {
        results.failed++;
        results.errors.push({ event, error: error.message });
        logger.error('Error processing PLAYER_REVIVED:', { error: error.message, event: JSON.stringify(event) });
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