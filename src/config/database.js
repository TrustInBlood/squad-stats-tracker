const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

// Create Sequelize instance
const sequelize = new Sequelize({
    dialect: 'mariadb',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'squad_stats',
    logging: (msg) => logger.debug(msg),
    define: {
        timestamps: true, // Adds createdAt and updatedAt timestamps
        underscored: true, // Use snake_case for fields
    }
});

// Test the connection
async function testConnection() {
    try {
        await sequelize.authenticate();
        logger.info('Database connection has been established successfully.');
        return true;
    } catch (error) {
        logger.error('Unable to connect to the database. Bot will run in degraded mode without database access: ', error);
        return false;
    }
}

module.exports = {
    sequelize,
    testConnection
}; 