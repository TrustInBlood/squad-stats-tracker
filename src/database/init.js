const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');
const sequelize = require('./config/database').sequelize;

async function runMigrations() {
    try {
        // Get the Sequelize CLI instance
        const { Umzug, SequelizeStorage } = require('umzug');
        const umzug = new Umzug({
            migrations: { 
                glob: 'src/database/migrations/*.js',
                resolve: ({ name, path, context }) => {
                    const migration = require(path);
                    return {
                        name,
                        up: async () => migration.up(context.queryInterface, context.sequelize),
                        down: async () => migration.down(context.queryInterface, context.sequelize)
                    };
                }
            },
            context: { queryInterface: sequelize.getQueryInterface(), sequelize },
            storage: new SequelizeStorage({ sequelize }),
            logger: {
                info: (msg) => logger.info(`[Migration] ${msg}`),
                warn: (msg) => logger.warn(`[Migration] ${msg}`),
                error: (msg) => logger.error(`[Migration] ${msg}`)
            }
        });

        // Check if we need to run migrations
        const pending = await umzug.pending();
        if (pending.length === 0) {
            logger.info('Database is up to date - no migrations needed');
            return true;
        }

        logger.info(`Running ${pending.length} pending migrations...`);
        
        // Run migrations
        await umzug.up();
        
        logger.info('Database migrations completed successfully');
        return true;
    } catch (error) {
        logger.error('Error running database migrations:', error);
        return false;
    }
}

async function initializeDatabase() {
    try {
        // Test connection first
        await sequelize.authenticate();
        logger.info('Database connection established successfully');

        // Run migrations
        const migrationsSuccess = await runMigrations();
        if (!migrationsSuccess) {
            logger.error('Database migrations failed - application may not function correctly');
            return false;
        }

        return true;
    } catch (error) {
        logger.error('Database initialization failed:', error);
        return false;
    }
}

module.exports = {
    initializeDatabase,
    runMigrations
}; 