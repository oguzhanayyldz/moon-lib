"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
// Pod ve servis isimlerini almak için
const POD_NAME = process.env.POD_NAME || process.env.HOSTNAME || 'unknown-pod';
const SERVICE_NAME = process.env.SERVICE_NAME || 'unknown-service';
// Renklendirme ve formatlama için format kombinasyonu
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.colorize(), winston_1.default.format.printf(({ level, message, timestamp }) => {
    return `[${timestamp}] [${SERVICE_NAME}] [${POD_NAME}] [${level}]: ${message}`;
}));
// Logger oluşturma
exports.logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: consoleFormat,
    transports: [
        new winston_1.default.transports.Console()
    ]
});
// Test edici bir log mesajı
exports.logger.info('Logger initialized');
