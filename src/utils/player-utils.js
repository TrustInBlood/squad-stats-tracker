// src/utils/player-utils.js
const { Op } = require('sequelize');
const { sequelize, Player } = require('../database/models');
const logger = require('./logger');

function sanitizePlayerName(name) {
  if (!name || typeof name !== 'string') {
    logger.warn('Invalid name provided, returning Unknown', { name });
    return 'Unknown';
  }
  let sanitized = name.trim().slice(0, 100);
  sanitized = sanitized.replace(/[\x00-\x1F\x7F-\u200D\uFEFF]/g, '');
  sanitized = sanitized.replace(/[^a-zA-Z0-9\s\-_.!@#$%^&*()+=]/g, '');
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  if (!sanitized) {
    logger.warn('Sanitized name is empty, returning Unknown', { originalName: name });
    return 'Unknown';
  }
  logger.debug('Sanitized player name', { originalName: name, sanitizedName: sanitized });
  return sanitized;
}

function extractPlayerData(eventData) {
  const { attacker, victim, player } = eventData;
  if (!attacker && !victim && !player) {
    logger.warn('Skipping event: No attacker, victim, or player data', { eventData });
    return null;
  }
  return { attacker, victim, player };
}

async function upsertPlayer(event, transaction = null) {
  const playerData = extractPlayerData(event.data);
  if (!playerData) {
    logger.warn('No player data extracted, skipping upsert', { event });
    return null;
  }

  const { attacker, victim, player } = playerData;
  const playersToUpsert = [];
  if (attacker) playersToUpsert.push({ ...attacker, steamID: event.data.attackerSteamID, eosID: event.data.attackerEOSID });
  if (victim) playersToUpsert.push({ ...victim, steamID: event.data.victimSteamID, eosID: event.data.victimEOSID });
  if (player) playersToUpsert.push({ ...player, steamID: event.data.steamID || player.steamID, eosID: event.data.eosID || player.eosID });

  const playerIds = [];
  for (const player of playersToUpsert) {
    if (!player.steamID && !player.eosID) {
      logger.warn('No valid player data for upsert, skipping', { 
        playerName: player.name, 
        steamID: player.steamID, 
        eosID: player.eosID, 
        eventType: event.event 
      });
      continue;
    }

    const sanitizedName = sanitizePlayerName(player.name);
    if (!sanitizedName) {
      logger.warn('Invalid sanitized name, skipping player', { 
        playerName: player.name, 
        steamID: player.steamID, 
        eosID: player.eosID, 
        eventType: event.event 
      });
      continue;
    }

    const timestamp = event.timestamp ? new Date(event.timestamp) : new Date();
    if (isNaN(timestamp)) {
      logger.warn('Invalid timestamp, using current time', { timestamp: event.timestamp });
      timestamp = new Date();
    }

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        logger.info('Attempting to upsert player:', {
          steamID: player.steamID,
          eosID: player.eosID,
          name: player.name,
          sanitizedName,
          timestamp: timestamp.toISOString(),
          attempt: attempt + 1,
          eventType: event.event,
        });

        const [record, created] = await Player.findOrCreate({
          where: {
            [Op.or]: [
              { steam_id: player.steamID || null },
              { eos_id: player.eosID || null },
            ],
          },
          defaults: {
            steam_id: player.steamID,
            eos_id: player.eosID,
            last_known_name: sanitizedName,
            first_seen: timestamp,
            last_seen: timestamp,
            created_at: timestamp,
            updated_at: timestamp,
          },
          transaction,
        });

        logger.info('findOrCreate result:', { created, playerId: record?.id, eventType: event.event });

        if (!created) {
          await record.update({
            last_known_name: sanitizedName,
            last_seen: timestamp,
            updated_at: timestamp,
            steam_id: player.steamID || record.steam_id,
            eos_id: player.eosID || record.eos_id,
          }, { transaction });
          logger.info('Updated existing player:', { playerId: record.id, eventType: event.event });
        }

        if (!record || !record.id) {
          logger.error('Player record or ID not found after findOrCreate', { player, eventType: event.event });
          continue;
        }

        playerIds.push(record.id);
        break;
      } catch (error) {
        if (error.name === 'SequelizeDatabaseError' && error.message.includes('Deadlock found') && attempt < maxRetries - 1) {
          attempt++;
          logger.warn(`Deadlock detected, retrying (${attempt}/${maxRetries})`, {
            steamID: player.steamID,
            eosID: player.eosID,
            name: player.name,
            eventType: event.event,
          });
          await new Promise(resolve => setTimeout(resolve, 100 * attempt));
          continue;
        }
        logger.error('Failed to upsert player:', {
          error: error.message,
          stack: error.stack,
          errors: error.errors ? error.errors.map(e => ({
            field: e.path,
            message: e.message,
            value: e.value,
          })) : undefined,
          steamID: player.steamID,
          eosID: player.eosID,
          name: player.name,
          sanitizedName,
          eventType: event.event,
        });
        continue;
      }
    }
  }

  if (playerIds.length === 0) {
    logger.warn('No players upserted for event', { eventType: event.event, fullEvent: event });
  }
  return playerIds.length > 0 ? playerIds : null;
}

module.exports = { upsertPlayer, sanitizePlayerName };