const winston = require('winston');

// Custom format to filter out non-essential logs
const filterNonEssential = winston.format((info) => {
    // Always keep error, warn, and info level messages
    if (info.level === 'error' || info.level === 'warn' || info.level === 'info') {
        return info;
    }

    // For debug level, only keep essential messages
    if (info.level === 'debug') {
        // Keep database-related messages
        if (info.message && (
            info.message.includes('[Database]') ||
            info.message.includes('[Migration]') ||
            info.message.includes('Flushed') ||
            info.message.includes('Failed to process') ||
            info.message.includes('Database connection') ||
            info.message.includes('Database initialization') ||
            info.message.includes('Database migrations')
        )) {
            return info;
        }

        // Filter out non-essential debug messages
        if (info.message && (
            info.message.includes('Socket event received') ||
            info.message.includes('Untracked event received') ||
            info.message.includes('PLAYER_POSSESS') ||
            info.message.includes('PLAYER_UNPOSSESS') ||
            info.message.includes('UPDATED_PLAYER_INFORMATION') ||
            info.message.includes('SQUAD_CREATED') ||
            info.message.includes('PLAYER_SQUAD_CHANGE') ||
            info.message.includes('TICK_RATE') ||
            (info.message.includes('PLAYER_DAMAGED') && !info.message.includes('Error')) ||
            info.message.includes('START TRANSACTION') ||
            info.message.includes('COMMIT') ||
            info.message.includes('Connection') ||
            info.message.includes('Reconnection')
        )) {
            return false;
        }
    }

    return info;
});

const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
        filterNonEssential(),
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: { service: 'squad-stats-bot' },
    transports: [
        new winston.transports.File({ 
            filename: 'logs/error.log', 
            level: 'error',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }),
        new winston.transports.File({ 
            filename: 'logs/combined.log',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        })
    ]
});

// If we're not in production, also log to the console with colors
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ level, message, timestamp, ...metadata }) => {
                let msg = `${timestamp} [${level}]: ${message}`;
                if (Object.keys(metadata).length > 0 && metadata.service) {
                    msg += ` ${JSON.stringify(metadata)}`;
                }
                return msg;
            })
        )
    }));
} else {
    // In production, log to console but only info level and above
    logger.add(new winston.transports.Console({
        level: 'info',
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

module.exports = logger; 