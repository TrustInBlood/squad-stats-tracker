const { Umzug, SequelizeStorage } = require('umzug');
const { sequelize } = require('./connection');
const logger = require('../utils/logger');

const umzug = new Umzug({
  migrations: {
    glob: 'src/database/migrations/*.js',
    resolve: ({ name, path, context }) => {
      const migration = require(path);
      return {
        name,
        up: async () => migration.up(context.queryInterface, context.Sequelize),
        down: async () => migration.down(context.queryInterface, context.Sequelize),
      };
    },
  },
  context: {
    queryInterface: sequelize.getQueryInterface(),
    Sequelize: require('sequelize'),
  },
  storage: new SequelizeStorage({ sequelize }),
  logger: {
    info: (message) => logger.info(`[Migration] ${message}`),
    warn: (message) => logger.warn(`[Migration] ${message}`),
    error: (message) => logger.error(`[Migration] ${message}`),
    debug: (message) => logger.debug(`[Migration] ${message}`),
  },
});

async function runUmzugMigrations() {
  try {
    const pending = await umzug.pending();
    if (pending.length === 0) {
      logger.info('No pending migrations');
      return;
    }
    logger.info(`Running ${pending.length} pending migrations...`);
    await umzug.up();
  } catch (error) {
    logger.error('Migration failed:', { message: error.message, stack: error.stack });
    throw error;
  }
}

module.exports = { runUmzugMigrations };