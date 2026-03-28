"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
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
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.colorize(), winston_1.default.format.printf((_a) => {
    var { level, message, timestamp } = _a, meta = __rest(_a, ["level", "message", "timestamp"]);
    // Meta verileri işle
    const metaStr = Object.keys(meta).length > 0 ? ' ' + JSON.stringify(meta) : '';
    return `[${timestamp}] [${SERVICE_NAME}] [${POD_NAME}] [${level}]: ${message}${metaStr}`;
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
