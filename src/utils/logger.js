// src/utils/logger.js
const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const customFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
  const filteredMeta = metadata.metadata || {};
  delete filteredMeta.service;
  const metaString = Object.keys(filteredMeta).length ? ` ${JSON.stringify(filteredMeta)}` : '';
  return `${timestamp} [${level.toUpperCase()}]: ${message}${metaString}`;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
    customFormat
  ),
  defaultMeta: { service: 'squad-stats-bot' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.colorize({ level: true }),
        winston.format.printf(({ level, message, timestamp, ...metadata }) => {
          const filteredMeta = metadata.metadata || {};
          delete filteredMeta.service;
          const metaString = Object.keys(filteredMeta).length ? ` ${JSON.stringify(filteredMeta)}` : '';
          return `${timestamp} [${level}]: ${message}${metaString}`;
        })
      ),
    }),
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 5242880,
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json()
      ),
    }),
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json()
      ),
    }),
  ],
});

module.exports = logger;