const winston = require('winston');
const path = require('path');

// Define log categories
const LOG_CATEGORIES = {
    VERIFICATION: 'verification',  // Account linking and verification
    DATABASE: 'database',         // Database operations
    SERVER: 'server',            // Server connection and events
    COMMAND: 'command',          // Discord command handling
    CHAT: 'chat',               // Chat event handling
    SYSTEM: 'system'            // General system operations
};

// Create a custom format that includes the category
const categoryFormat = winston.format.printf(({ level, message, category, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level.toUpperCase()}]`;
    if (category) {
        msg += ` [${category}]`;
    }
    msg += `: ${message}`;
    
    // Add metadata if present, but exclude service
    const filteredMeta = { ...metadata };
    delete filteredMeta.service;
    if (Object.keys(filteredMeta).length > 0) {
        msg += ` ${JSON.stringify(filteredMeta)}`;
    }
    
    return msg;
});

// Create the logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'category'] }),
        categoryFormat
    ),
    defaultMeta: { service: 'squad-stats-bot' },
    transports: [
        // Console transport with color
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize({ all: true }),
                winston.format.timestamp({
                    format: 'YYYY-MM-DD HH:mm:ss'
                }),
                winston.format.printf(({ level, message, category, timestamp, ...metadata }) => {
                    let msg = `${timestamp} [${level}]`;
                    if (category) {
                        msg += ` [${category}]`;
                    }
                    msg += `: ${message}`;
                    
                    // Add metadata if present, but exclude service
                    const filteredMeta = { ...metadata };
                    delete filteredMeta.service;
                    if (Object.keys(filteredMeta).length > 0) {
                        msg += ` ${JSON.stringify(filteredMeta)}`;
                    }
                    
                    return msg;
                })
            )
        }),
        // File transport for all logs
        new winston.transports.File({ 
            filename: path.join('logs', 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            format: winston.format.combine(
                winston.format.timestamp({
                    format: 'YYYY-MM-DD HH:mm:ss'
                }),
                winston.format.json()
            )
        }),
        // Separate file for errors
        new winston.transports.File({ 
            filename: path.join('logs', 'error.log'), 
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            format: winston.format.combine(
                winston.format.timestamp({
                    format: 'YYYY-MM-DD HH:mm:ss'
                }),
                winston.format.json()
            )
        })
    ]
});

// Helper functions to create category-specific loggers
const createCategoryLogger = (category) => ({
    error: (message, meta = {}) => logger.error(message, { ...meta, category }),
    warn: (message, meta = {}) => logger.warn(message, { ...meta, category }),
    info: (message, meta = {}) => logger.info(message, { ...meta, category }),
    debug: (message, meta = {}) => logger.debug(message, { ...meta, category }),
    verbose: (message, meta = {}) => logger.verbose(message, { ...meta, category })
});

// Export category-specific loggers
module.exports = {
    LOG_CATEGORIES,
    verification: createCategoryLogger(LOG_CATEGORIES.VERIFICATION),
    database: createCategoryLogger(LOG_CATEGORIES.DATABASE),
    server: createCategoryLogger(LOG_CATEGORIES.SERVER),
    command: createCategoryLogger(LOG_CATEGORIES.COMMAND),
    chat: createCategoryLogger(LOG_CATEGORIES.CHAT),
    system: createCategoryLogger(LOG_CATEGORIES.SYSTEM),
    // Also export the base logger for backward compatibility
    error: logger.error.bind(logger),
    warn: logger.warn.bind(logger),
    info: logger.info.bind(logger),
    debug: logger.debug.bind(logger),
    verbose: logger.verbose.bind(logger)
}; 