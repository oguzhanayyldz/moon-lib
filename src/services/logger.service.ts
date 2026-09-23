import winston from 'winston';
import { isLoggableError, maskErrorText, serializeLogMeta, toSafeLogError } from '../utils/logSafety.util';

// Pod ve servis isimlerini almak için
const POD_NAME = process.env.POD_NAME || process.env.HOSTNAME || 'unknown-pod';
const SERVICE_NAME = process.env.SERVICE_NAME || 'unknown-service';

// triple-beam's SPLAT: the raw arguments passed after the message.
const SPLAT = Symbol.for('splat');
// Keys an unpacked axios error leaves in the meta when the raw error is no longer at hand.
const UNPACKED_ERROR_KEYS = ['config', 'request', 'response', 'isAxiosError', 'stack', 'cause', 'code', 'name', 'status'];

type LogInfo = winston.Logform.TransformableInfo & { [SPLAT]?: unknown[] };

/**
 * Builds the log line. It never throws: `logger.error(msg, err)` runs this synchronously inside the
 * caller's `catch`, so a throw here would replace the caller's error.
 *
 * winston copies the enumerable fields of an error passed as `logger.error(msg, err)` into the meta
 * (config, request, response, ... for an AxiosError) and appends `err.message` to the message. Those
 * copied fields are replaced by the `toSafeLogError` whitelist, and the appended message is masked.
 */
export function formatLogLine(info: LogInfo): string {
    try {
        const { level, message, timestamp, ...rest } = info;
        const prefix = `[${timestamp}] [${SERVICE_NAME}] [${POD_NAME}] [${level}]:`;
        let text = String(message);
        let meta: Record<string, unknown> = rest;
        const splatError = info[SPLAT]?.[0];
        // `logger.error(msg, err)` logs a copy of the error (the raw one stays in SPLAT); `logger.error(err)`
        // logs the error object itself. The copy is a plain object, so `info` counts only as an Error instance.
        const rawError = (isLoggableError(splatError) ? splatError : info instanceof Error ? info : undefined) as
            | Record<string, unknown>
            | undefined;
        if (rawError) {
            const { message: errorMessage, ...safeFields } = toSafeLogError(rawError);
            // A plain object marked `isAxiosError` (a `{ ...err }` copy) keeps its other keys, such as an order id.
            const errorKeys = rawError instanceof Error
                ? new Set([...Object.keys(rawError), 'stack', 'cause', 'message', 'name'])
                : new Set([...UNPACKED_ERROR_KEYS, 'message']);
            meta = { ...omitKeys(rest, errorKeys), ...safeFields };
            text = rawError === info ? errorMessage : replaceAppendedMessage(text, rawError.message, errorMessage);
        } else if (looksLikeUnpackedAxiosError(rest)) {
            const { message: _ignored, ...safeFields } = toSafeLogError(rest);
            meta = { ...omitKeys(rest, new Set(UNPACKED_ERROR_KEYS)), ...safeFields };
            text = maskErrorText(text);
        }
        const metaStr = Object.keys(meta).length > 0 ? ' ' + serializeLogMeta(meta) : '';
        return `${prefix} ${text}${metaStr}`;
    } catch {
        return `[${SERVICE_NAME}] [${POD_NAME}]: [log line could not be formatted]`;
    }
}

// Without the `isAxiosError` flag, `config` must look like an HTTP request config (it carries the URL or
// headers), so that ordinary meta such as `{ config: settings, request: body }` is left as it is.
function looksLikeUnpackedAxiosError(meta: Record<string, unknown>): boolean {
    if (meta.isAxiosError === true) {
        return true;
    }
    return isObject(meta.config) && isObject(meta.request) && ('url' in meta.config || 'headers' in meta.config);
}

function replaceAppendedMessage(text: string, rawMessage: unknown, safeMessage: string): string {
    if (typeof rawMessage !== 'string' || !rawMessage || !text.endsWith(` ${rawMessage}`)) {
        return text;
    }
    return `${text.slice(0, text.length - rawMessage.length)}${safeMessage}`;
}

function omitKeys(source: Record<string, unknown>, keys: Set<string>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(source).filter(([key]) => !keys.has(key)));
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

// Renklendirme ve formatlama için format kombinasyonu
const consoleFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(formatLogLine)
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
