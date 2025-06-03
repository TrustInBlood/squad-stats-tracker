const { EmbedBuilder } = require('discord.js');
const cron = require('node-cron');
const logger = require('./logger');

/**
 * Updates the leaderboard message with top killers and revivers
 * @param {Client} client - Discord.js client
 * @param {Sequelize} sequelize - Sequelize instance
 * @param {string} leaderboardType - Type of leaderboard (e.g., "24h", "7d")
 * @param {string} timeRange - Time range for stats (e.g., "24h", "7d")
 */
async function updateLeaderboard(client, sequelize, leaderboardType = "24h", timeRange = "24h") {
  try {
    const { Kill, Revive, Player, LeaderboardConfig } = sequelize.models;
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

    // Get top killers
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
      where: sequelize.literal(`Kill.created_at >= DATE_SUB(NOW(), INTERVAL ${timeRange === "24h" ? "24" : "168"} HOUR)`),
      group: ['Kill.attacker_id', 'attacker.id', 'attacker.last_known_name'],
      order: [[sequelize.literal('kill_count'), 'DESC']],
      limit: 10
    });

    // Get top revivers
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
      where: sequelize.literal(`Revive.created_at >= DATE_SUB(NOW(), INTERVAL ${timeRange === "24h" ? "24" : "168"} HOUR)`),
      group: ['Revive.reviver_id', 'reviver.id', 'reviver.last_known_name'],
      order: [[sequelize.literal('revive_count'), 'DESC']],
      limit: 10
    });

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle(`${timeRange === "24h" ? "24-Hour" : "7-Day"} Squad Leaderboard`)
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
        }
      )
      .setFooter({ text: `Last updated` })
      .setTimestamp();

    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      logger.error(`Leaderboard channel ${channelId} not found`);
      return;
    }

    try {
      if (config.message_id) {
        const message = await channel.messages.fetch(config.message_id).catch(() => null);
        if (message) {
          await message.edit({ embeds: [embed] });
          logger.info(`Updated existing leaderboard message for ${leaderboardType}`);
          return;
        }
      }
      // If no message_id or message not found, send new message
      const newMessage = await channel.send({ embeds: [embed] });
      await config.update({ message_id: newMessage.id });
      logger.info(`Created new leaderboard message for ${leaderboardType}`);
    } catch (error) {
      logger.error(`Error updating leaderboard message: ${error.message}`);
      // If message update fails, try to send new message
      try {
        const newMessage = await channel.send({ embeds: [embed] });
        await config.update({ message_id: newMessage.id });
        logger.info(`Created new leaderboard message after error for ${leaderboardType}`);
      } catch (retryError) {
        logger.error(`Failed to create new leaderboard message: ${retryError.message}`);
      }
    }
  } catch (error) {
    logger.error(`Error in updateLeaderboard: ${error.message}`);
  }
}

/**
 * Initializes the leaderboard cron job
 * @param {Client} client - Discord.js client
 * @param {Sequelize} sequelize - Sequelize instance
 */
function initLeaderboardCron(client, sequelize) {
  // Get interval from env var or default to hourly
  const intervalMinutes = parseInt(process.env.LEADERBOARD_INTERVAL_MINUTES) || 60;
  const cronSchedule = `0 */${intervalMinutes} * * *`;

  // Run immediately on startup
  updateLeaderboard(client, sequelize);

  // Schedule regular updates
  cron.schedule(cronSchedule, () => {
    updateLeaderboard(client, sequelize);
  });

  logger.info(`Leaderboard cron job initialized with schedule: ${cronSchedule}`);
}

module.exports = {
  updateLeaderboard,
  initLeaderboardCron
}; 