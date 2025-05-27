require('dotenv').config();
const { Sequelize } = require('sequelize');
const logger = require('../../utils/logger');

const config = {
  development: {
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'squad_stats',
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    dialect: 'mariadb',
    logging: (msg) => logger.debug(`[Database] ${msg}`),
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  test: {
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'squad_stats_test',
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    dialect: 'mariadb',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mariadb',
    logging: (msg) => logger.debug(`[Database] ${msg}`),
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000
    }
  }
};

// Get the current environment
const env = process.env.NODE_ENV || 'development';
const currentConfig = config[env];

// Create Sequelize instance
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
    define: {
      timestamps: true, // Adds createdAt and updatedAt timestamps
      underscored: true, // Use snake_case rather than camelCase
      freezeTableName: true // Don't pluralize table names
    }
  }
);

// Test the connection
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
  config,
  sequelize,
  testConnection
}; 