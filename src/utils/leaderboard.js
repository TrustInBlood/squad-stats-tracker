const { EmbedBuilder } = require('discord.js');
const cron = require('node-cron');
const logger = require('./logger');
const { Op } = require('sequelize');

// Configuration constants
const LEADERBOARD_TYPES = {
  '24h': {
    name: '24-Hour',
    hours: 24,
    cronInterval: 60 // minutes
  },
  '7d': {
    name: '7-Day',
    hours: 168,
    cronInterval: 360 // minutes (6 hours)
  }
};

/**
 * Validates leaderboard parameters
 * @param {string} leaderboardType - Type of leaderboard
 * @param {string} timeRange - Time range for stats
 * @returns {boolean} Whether parameters are valid
 */
function validateLeaderboardParams(leaderboardType, timeRange) {
  if (!LEADERBOARD_TYPES[leaderboardType]) {
    logger.error(`Invalid leaderboard type: ${leaderboardType}`);
    return false;
  }
  if (!LEADERBOARD_TYPES[timeRange]) {
    logger.error(`Invalid time range: ${timeRange}`);
    return false;
  }
  return true;
}

/**
 * Cleans up old leaderboard messages in the channel
 * @param {TextChannel} channel - Discord channel
 * @param {LeaderboardConfig} config - Leaderboard config
 */
async function cleanupOldMessages(channel, config) {
  try {
    // Get all messages in the channel
    const messages = await channel.messages.fetch({ limit: 100 });
    
    // Find messages that are leaderboard embeds for this specific type but not our current one
    const oldMessages = messages.filter(msg => 
      msg.author.id === channel.client.user.id && 
      msg.embeds.length > 0 &&
      msg.embeds[0].title?.includes(`${LEADERBOARD_TYPES[config.leaderboard_type].name} Squad Leaderboard`) &&
      msg.id !== config.message_id
    );

    if (oldMessages.size > 0) {
      logger.info(`Cleaning up ${oldMessages.size} old ${config.leaderboard_type} leaderboard messages`);
      await channel.bulkDelete(oldMessages);
    }
  } catch (error) {
    logger.error('Error cleaning up old leaderboard messages:', error);
  }
}

/**
 * Updates the leaderboard message with top killers, revivers, and knife kills
 * @param {Client} client - Discord.js client
 * @param {Sequelize} sequelize - Sequelize instance
 * @param {string} leaderboardType - Type of leaderboard (e.g., "24h", "7d")
 * @param {string} timeRange - Time range for stats (e.g., "24h", "7d")
 */
async function updateLeaderboard(client, sequelize, leaderboardType = "24h", timeRange = "24h") {
  if (!validateLeaderboardParams(leaderboardType, timeRange)) {
    return;
  }

  try {
    const { Kill, Revive, Player, LeaderboardConfig, Weapon } = sequelize.models;
    const channelId = process.env.LEADERBOARD_CHANNEL_ID;

    if (!channelId) {
      logger.error('LEADERBOARD_CHANNEL_ID not set in environment variables');
      return;
    }

    // Get or create leaderboard config
    let [config] = await LeaderboardConfig.findOrCreate({
      where: { channel_id: channelId, leaderboard_type: leaderboardType },
      defaults: { channel_id: channelId, leaderboard_type: leaderboardType }
    });

    const hours = LEADERBOARD_TYPES[timeRange].hours;
    const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));

    try {
      // Get player statistics
      const [totalPlayers, newPlayers, firstPlayer] = await Promise.all([
        // Total tracked players
        Player.count(),
        // New players in the specified time range (e.g., 24h or 7d)
        Player.count({
          where: {
            created_at: {
              [Op.gte]: cutoffTime
            }
          }
        }),
        // First player record
        Player.findOne({
          order: [['created_at', 'ASC']],
          attributes: ['created_at']
        })
      ]);

      // Format the first player date
      const firstPlayerDate = firstPlayer ? new Date(firstPlayer.created_at) : null;
      const sinceText = firstPlayerDate 
        ? `Since: <t:${Math.floor(firstPlayerDate.getTime() / 1000)}:F>`
        : 'No player records';

      // Get top killers using parameterized query
      const topKillers = await Kill.findAll({
        attributes: [
          'attacker_id',
          [sequelize.fn('COUNT', sequelize.col('Kill.id')), 'kill_count']
        ],
        include: [{
          model: Player,
          as: 'attacker',
          attributes: ['last_known_name']
        }],
        where: {
          created_at: {
            [Op.gte]: cutoffTime
          }
        },
        group: ['Kill.attacker_id', 'attacker.id', 'attacker.last_known_name'],
        order: [[sequelize.literal('kill_count'), 'DESC']],
        limit: 10
      });

      // Get top revivers using parameterized query
      const topRevivers = await Revive.findAll({
        attributes: [
          'reviver_id',
          [sequelize.fn('COUNT', sequelize.col('Revive.id')), 'revive_count']
        ],
        include: [{
          model: Player,
          as: 'reviver',
          attributes: ['last_known_name']
        }],
        where: {
          created_at: {
            [Op.gte]: cutoffTime
          }
        },
        group: ['Revive.reviver_id', 'reviver.id', 'reviver.last_known_name'],
        order: [[sequelize.literal('revive_count'), 'DESC']],
        limit: 10
      });

      // Get top knife killers
      const topKnifeKillers = await Kill.findAll({
        attributes: [
          'attacker_id',
          [sequelize.fn('COUNT', sequelize.col('Kill.id')), 'knife_kill_count']
        ],
        include: [
          {
            model: Player,
            as: 'attacker',
            attributes: ['last_known_name']
          },
          {
            model: Weapon,
            required: true,
            where: {
              name: {
                [Op.like]: '%bayonet%'
              }
            }
          }
        ],
        where: {
          created_at: {
            [Op.gte]: cutoffTime
          }
        },
        group: ['Kill.attacker_id', 'attacker.id', 'attacker.last_known_name'],
        order: [[sequelize.literal('knife_kill_count'), 'DESC']],
        limit: 10
      });

      // Create embed with all fields
      const embed = new EmbedBuilder()
        .setTitle(`${LEADERBOARD_TYPES[timeRange].name} Squad Leaderboard`)
        .setColor('#00ff00')
        .addFields(
          {
            name: 'Top Killers',
            value: topKillers.map((kill, index) => 
              `${index + 1}. ${kill.attacker?.last_known_name || 'Unknown'}: ${kill.getDataValue('kill_count')} kills`
            ).join('\n') || 'No kills recorded',
            inline: true
          },
          {
            name: 'Top Revivers',
            value: topRevivers.map((revive, index) => 
              `${index + 1}. ${revive.reviver?.last_known_name || 'Unknown'}: ${revive.getDataValue('revive_count')} revives`
            ).join('\n') || 'No revives recorded',
            inline: true
          },
          {
            name: 'Top Knife Kills',
            value: topKnifeKillers.map((kill, index) => 
              `${index + 1}. ${kill.attacker?.last_known_name || 'Unknown'}: ${kill.getDataValue('knife_kill_count')} knife kills`
            ).join('\n') || 'No knife kills recorded',
            inline: true
          },
          {
            name: 'Player Statistics',
            value: `Total Tracked Players: ${totalPlayers.toLocaleString()} (${sinceText})\nNew Players (${LEADERBOARD_TYPES[timeRange].name}): ${newPlayers.toLocaleString()}`,
            inline: false
          },
          {
            name: 'Need Help?',
            value: 'Use `/help` to see all available commands and their descriptions. When using commands, make sure the bot profile picture matches the profile picture on this embed.',
            inline: false
          }
        )
        .setFooter({ text: 'Stats exclude KOTH mod servers • Last updated' })
        .setTimestamp();

      const channel = await client.channels.fetch(channelId);
      if (!channel) {
        throw new Error(`Leaderboard channel ${channelId} not found`);
      }

      // First try to update existing message if we have a message_id
      if (config.message_id) {
        try {
          const message = await channel.messages.fetch(config.message_id).catch(() => null);
          if (message) {
            await message.edit({ embeds: [embed] });
            logger.info(`Updated existing leaderboard message for ${leaderboardType}`);
            return;
          }
        } catch (discordError) {
          logger.error(`Discord API error updating existing leaderboard message: ${discordError.message}`);
        }
      }

      // If we couldn't update the existing message, clean up old messages and create a new one
      await cleanupOldMessages(channel, config);

      try {
        // Send new message
        const newMessage = await channel.send({ embeds: [embed] });
        await config.update({ message_id: newMessage.id });
        logger.info(`Created new leaderboard message for ${leaderboardType}`);
      } catch (discordError) {
        logger.error(`Discord API error creating new leaderboard message: ${discordError.message}`);
        throw discordError;
      }
    } catch (dbError) {
      logger.error(`Database error in updateLeaderboard: ${dbError.message}`);
      throw dbError; // Re-throw to be caught by outer try-catch
    }
  } catch (error) {
    if (error.name === 'SequelizeDatabaseError') {
      logger.error(`Database error in updateLeaderboard: ${error.message}`);
    } else if (error.name === 'DiscordAPIError') {
      logger.error(`Discord API error in updateLeaderboard: ${error.message}`);
    } else {
      logger.error(`Unexpected error in updateLeaderboard: ${error.message}`);
    }
  }
}

/**
 * Initializes the leaderboard cron job
 * @param {Client} client - Discord.js client
 * @param {Sequelize} sequelize - Sequelize instance
 * @param {string} leaderboardType - Type of leaderboard (e.g., "24h", "7d")
 * @param {string} timeRange - Time range for stats (e.g., "24h", "7d")
 */
function initLeaderboardCron(client, sequelize, leaderboardType = '24h', timeRange = '24h') {
  try {
    if (!validateLeaderboardParams(leaderboardType, timeRange)) {
      logger.error(`Invalid parameters for cron job: ${leaderboardType}, ${timeRange}`);
      return;
    }

    // Get interval from env var or use the configured interval for the leaderboard type
    const envVar = `LEADERBOARD_INTERVAL_${leaderboardType.toUpperCase()}_MINUTES`;
    const envValue = process.env[envVar];
    const defaultInterval = LEADERBOARD_TYPES[leaderboardType].cronInterval;
    const intervalMinutes = envValue ? parseInt(envValue) : defaultInterval;
    
    logger.info(`[DEBUG] ${leaderboardType} leaderboard initialization:
      - Environment variable ${envVar}: ${envValue || 'not set'}
      - Default interval from LEADERBOARD_TYPES: ${defaultInterval}
      - Final interval used: ${intervalMinutes}
      - Current time: ${new Date().toISOString()}`);
    
    // For minute-based intervals, use a different cron format
    let cronSchedule;
    if (intervalMinutes === 1) {
      cronSchedule = '* * * * *';  // Every minute
    } else if (intervalMinutes < 60) {
      cronSchedule = `*/${intervalMinutes} * * * *`;  // Every X minutes
    } else if (intervalMinutes === 60) {
      cronSchedule = '0 * * * *';  // Every hour
    } else {
      // For intervals longer than an hour, use the hour field
      const hours = Math.floor(intervalMinutes / 60);
      cronSchedule = `0 */${hours} * * *`;  // Every X hours
    }
    
    logger.info(`[DEBUG] ${leaderboardType} leaderboard cron schedule: ${cronSchedule} (every ${intervalMinutes} minutes)`);

    // Run immediately on startup
    logger.info(`Running initial ${leaderboardType} leaderboard update...`);
    updateLeaderboard(client, sequelize, leaderboardType, timeRange).catch(error => {
      logger.error(`Failed to run initial ${leaderboardType} leaderboard update:`, error);
    });

    // Schedule regular updates
    const job = cron.schedule(cronSchedule, () => {
      logger.info(`Running scheduled ${leaderboardType} leaderboard update...`);
      updateLeaderboard(client, sequelize, leaderboardType, timeRange).catch(error => {
        logger.error(`Failed to run scheduled ${leaderboardType} leaderboard update:`, error);
      });
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    if (!job) {
      logger.error(`Failed to create ${leaderboardType} leaderboard cron job`);
      return;
    }

    if (!job.running) {
      job.start();
    }

    logger.info(`${leaderboardType} leaderboard cron job successfully scheduled`);
  } catch (error) {
    logger.error(`Failed to initialize ${leaderboardType} leaderboard cron job:`, error);
  }
}

module.exports = {
  updateLeaderboard,
  initLeaderboardCron,
  LEADERBOARD_TYPES
};