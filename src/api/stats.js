const { Kill, Revive, Player } = require('../database/models');
const { sequelize } = require('../database/connection');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

async function getPlayerStats(steamId, sinceDate = null) {
  const transaction = await sequelize.transaction();

  try {
    const player = await Player.findOne({
      where: { steam_id: steamId },
      transaction
    });

    if (!player) {
      await transaction.commit();
      return null;
    }

    const playerId = player.id;
    const dateFilter = sinceDate ? { timestamp: { [Op.gte]: sinceDate } } : {};

    const kills = await Kill.count({ where: { attacker_id: playerId, ...dateFilter }, transaction });
    const deaths = await Kill.count({ where: { victim_id: playerId, ...dateFilter }, transaction });
    const teamkills = await Kill.count({ where: { attacker_id: playerId, teamkill: true, ...dateFilter }, transaction });
    const revivesGiven = await Revive.count({ where: { reviver_id: playerId, ...dateFilter }, transaction });
    const revivesReceived = await Revive.count({ where: { victim_id: playerId, ...dateFilter }, transaction });

    const nemesisData = await Kill.findAll({
      attributes: ['attacker_id'],
      where: {
        victim_id: playerId,
        attacker_id: { [Op.ne]: playerId },
        ...dateFilter
      },
      group: ['attacker_id'],
      order: [[sequelize.fn('COUNT', sequelize.col('attacker_id')), 'DESC']],
      limit: 1,
      include: [{ model: Player, as: 'attacker', attributes: ['last_known_name'] }],
      transaction
    });

    const nemesis = nemesisData.length > 0 ? nemesisData[0].attacker.last_known_name : null;
    const kdRatio = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);

    await transaction.commit();

    return {
      steamId: player.steam_id,
      playerName: player.last_known_name,
      kills,
      deaths,
      kdRatio: parseFloat(kdRatio),
      teamkills,
      revivesGiven,
      revivesReceived,
      nemesis,
      lastSeen: player.last_seen
    };
  } catch (error) {
    await transaction.rollback();
    logger.error(`Error fetching stats for Steam ID ${steamId}: ${error.message}`);
    throw error;
  }
}

module.exports = { getPlayerStats };
