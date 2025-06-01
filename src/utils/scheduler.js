const { prunePlayerWounded } = require('./prune-wounded-utils');
const cron = require('node-cron');
const logger = require('./logger');

function startScheduler() {
  cron.schedule('* * * * *', async () => {
    await prunePlayerWounded();
  });
  logger.info('Pruning task scheduled: every minute');
}

module.exports = { startScheduler };