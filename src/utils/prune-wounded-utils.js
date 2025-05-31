const { sequelize } = require('../database/connection');
const logger = require('./logger');

async function prunePlayerWounded() {
  try {
    const result = await sequelize.query(
      'DELETE FROM player_wounded WHERE created_at < NOW() - INTERVAL 10 MINUTE'
    );
    logger.info(`Pruned player_wounded: ${result[0].affectedRows} rows deleted`);
  } catch (error) {
    logger.error(`Pruning failed: ${error.message}`);
  }
}

module.exports = { prunePlayerWounded };