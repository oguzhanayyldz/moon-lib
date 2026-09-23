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
exports.formatLogLine = formatLogLine;
const winston_1 = __importDefault(require("winston"));
const logSafety_util_1 = require("../utils/logSafety.util");
// Pod ve servis isimlerini almak için
const POD_NAME = process.env.POD_NAME || process.env.HOSTNAME || 'unknown-pod';
const SERVICE_NAME = process.env.SERVICE_NAME || 'unknown-service';
// triple-beam's SPLAT: the raw arguments passed after the message.
const SPLAT = Symbol.for('splat');
// Keys an unpacked axios error leaves in the meta when the raw error is no longer at hand.
const UNPACKED_ERROR_KEYS = ['config', 'request', 'response', 'isAxiosError', 'stack', 'cause', 'code', 'name', 'status'];
/**
 * Builds the log line. It never throws: `logger.error(msg, err)` runs this synchronously inside the
 * caller's `catch`, so a throw here would replace the caller's error.
 *
 * winston copies the enumerable fields of an error passed as `logger.error(msg, err)` into the meta
 * (config, request, response, ... for an AxiosError) and appends `err.message` to the message. Those
 * copied fields are replaced by the `toSafeLogError` whitelist, and the appended message is masked.
 */
function formatLogLine(info) {
    var _a;
    try {
        const { level, message, timestamp } = info, rest = __rest(info, ["level", "message", "timestamp"]);
        const prefix = `[${timestamp}] [${SERVICE_NAME}] [${POD_NAME}] [${level}]:`;
        let text = String(message);
        let meta = rest;
        const splatError = (_a = info[SPLAT]) === null || _a === void 0 ? void 0 : _a[0];
        // `logger.error(msg, err)` logs a copy of the error (the raw one stays in SPLAT); `logger.error(err)`
        // logs the error object itself. The copy is a plain object, so `info` counts only as an Error instance.
        const rawError = ((0, logSafety_util_1.isLoggableError)(splatError) ? splatError : info instanceof Error ? info : undefined);
        if (rawError) {
            const _b = (0, logSafety_util_1.toSafeLogError)(rawError), { message: errorMessage } = _b, safeFields = __rest(_b, ["message"]);
            // A plain object marked `isAxiosError` (a `{ ...err }` copy) keeps its other keys, such as an order id.
            const errorKeys = rawError instanceof Error
                ? new Set([...Object.keys(rawError), 'stack', 'cause', 'message', 'name'])
                : new Set([...UNPACKED_ERROR_KEYS, 'message']);
            meta = Object.assign(Object.assign({}, omitKeys(rest, errorKeys)), safeFields);
            text = rawError === info ? errorMessage : replaceAppendedMessage(text, rawError.message, errorMessage);
        }
        else if (looksLikeUnpackedAxiosError(rest)) {
            const _c = (0, logSafety_util_1.toSafeLogError)(rest), { message: _ignored } = _c, safeFields = __rest(_c, ["message"]);
            meta = Object.assign(Object.assign({}, omitKeys(rest, new Set(UNPACKED_ERROR_KEYS))), safeFields);
            text = (0, logSafety_util_1.maskErrorText)(text);
        }
        const metaStr = Object.keys(meta).length > 0 ? ' ' + (0, logSafety_util_1.serializeLogMeta)(meta) : '';
        return `${prefix} ${text}${metaStr}`;
    }
    catch (_d) {
        return `[${SERVICE_NAME}] [${POD_NAME}]: [log line could not be formatted]`;
    }
}
// Without the `isAxiosError` flag, `config` must look like an HTTP request config (it carries the URL or
// headers), so that ordinary meta such as `{ config: settings, request: body }` is left as it is.
function looksLikeUnpackedAxiosError(meta) {
    if (meta.isAxiosError === true) {
        return true;
    }
    return isObject(meta.config) && isObject(meta.request) && ('url' in meta.config || 'headers' in meta.config);
}
function replaceAppendedMessage(text, rawMessage, safeMessage) {
    if (typeof rawMessage !== 'string' || !rawMessage || !text.endsWith(` ${rawMessage}`)) {
        return text;
    }
    return `${text.slice(0, text.length - rawMessage.length)}${safeMessage}`;
}
function omitKeys(source, keys) {
    return Object.fromEntries(Object.entries(source).filter(([key]) => !keys.has(key)));
}
function isObject(value) {
    return typeof value === 'object' && value !== null;
}
// Renklendirme ve formatlama için format kombinasyonu
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.colorize(), winston_1.default.format.printf(formatLogLine));
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
//# sourceMappingURL=logger.service.js.map