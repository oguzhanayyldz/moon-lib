import winston from 'winston';
declare const SPLAT: unique symbol;
type LogInfo = winston.Logform.TransformableInfo & {
    [SPLAT]?: unknown[];
};
/**
 * Builds the log line. It never throws: `logger.error(msg, err)` runs this synchronously inside the
 * caller's `catch`, so a throw here would replace the caller's error.
 *
 * winston copies the enumerable fields of an error passed as `logger.error(msg, err)` into the meta
 * (config, request, response, ... for an AxiosError) and appends `err.message` to the message. Those
 * copied fields are replaced by the `toSafeLogError` whitelist, and the appended message is masked.
 */
export declare function formatLogLine(info: LogInfo): string;
export declare const logger: winston.Logger;
export {};
