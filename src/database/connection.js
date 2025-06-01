const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');
const config = require('./config/database');

const env = process.env.NODE_ENV || 'development';
const currentConfig = config[env];

const sequelize = new Sequelize(
  currentConfig.database,
  currentConfig.username,
  currentConfig.password,
  {
    host: currentConfig.host,
    port: currentConfig.port,
    dialect: currentConfig.dialect,
    logging: currentConfig.logging,
    pool: currentConfig.pool,
    dialectOptions: currentConfig.dialectOptions,
    define: currentConfig.define,
  }
);

async function testConnection() {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
    return true;
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    return false;
  }
}

module.exports = {
  sequelize,
  testConnection,
};