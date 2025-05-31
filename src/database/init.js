const { sequelize, testConnection } = require('./connection');
const { runUmzugMigrations } = require('./migrate');
const logger = require('../utils/logger');

async function initializeDatabase() {
  try {
    const canConnect = await testConnection();
    if (!canConnect) {
      logger.error('Database initialization failed: Cannot connect to database');
      return false;
    }
    await runUmzugMigrations();
    logger.info('Database migrations completed successfully');
    return true;
  } catch (error) {
    logger.error('Database initialization failed:', { message: error.message, stack: error.stack });
    return false;
  }
}

async function runMigrations() {
  try {
    const canConnect = await testConnection();
    if (!canConnect) {
      throw new Error('Cannot connect to database');
    }
    await runUmzugMigrations();
    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error('Failed to run migrations:', { message: error.message, stack: error.stack });
    throw error;
  }
}

module.exports = { initializeDatabase, runMigrations };