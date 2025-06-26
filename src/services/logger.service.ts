import winston from 'winston';

// Pod ve servis isimlerini almak için
const POD_NAME = process.env.POD_NAME || process.env.HOSTNAME || 'unknown-pod';
const SERVICE_NAME = process.env.SERVICE_NAME || 'unknown-service';

// Renklendirme ve formatlama için format kombinasyonu
const consoleFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
        // Meta verileri işle
        const metaStr = Object.keys(meta).length > 0 ? ' ' + JSON.stringify(meta) : '';
        return `[${timestamp}] [${SERVICE_NAME}] [${POD_NAME}] [${level}]: ${message}${metaStr}`;
    })
);

// Logger oluşturma
export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: consoleFormat,
    transports: [
        new winston.transports.Console()
    ]
});

// Test edici bir log mesajı
logger.info('Logger initialized');