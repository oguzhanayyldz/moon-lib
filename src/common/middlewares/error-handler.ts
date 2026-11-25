import { Request, Response, NextFunction } from 'express';
import { CustomError } from '../errors/custom-error';
import { logger } from '../../services/logger.service';
import {
    hashTenantId,
    maskErrorText,
    maskLogMessageText,
    redactPersonalDataText,
    sanitizeRequestUrl
} from '../../utils/logSafety.util';

// UC-2365: bir 4xx satırına en çok bu kadar mesaj ve mesaj başına bu kadar karakter girer.
const MAX_4XX_MESSAGES = 3;
const MAX_4XX_MESSAGE_LENGTH = 200;
// 24 haneli hex (Mongo ObjectId) yol parçası: kimlik satıra yazılmaz, `:id` olur (Loki'de kardinalite de düşer).
const OBJECT_ID_SEGMENT = /\/[0-9a-fA-F]{24}(?=\/|$)/g;

const isClientErrorLoggingEnabled = (): boolean => {
    const setting = (process.env.LOG_4XX ?? '').trim().toLowerCase();
    return setting !== '0' && setting !== 'false';
};

const requestPath = (req: Request): string =>
    typeof req.originalUrl === 'string' ? sanitizeRequestUrl(req.originalUrl) : '';

const maskClientMessage = (message: unknown): string => {
    // Önce kişisel veri: bağlantı adresi maskeleyicisi `ali@x.com`'u userinfo sanıp yalnız yerel kısmı keser.
    const masked = maskLogMessageText(redactPersonalDataText(String(message ?? '')));
    return masked.length > MAX_4XX_MESSAGE_LENGTH ? `${masked.slice(0, MAX_4XX_MESSAGE_LENGTH - 1)}…` : masked;
};

/**
 * UC-2365: bir istemci hatasını (4xx) tek satır warn olarak yazar. Yazılanlar: durum, yöntem, query'siz ve
 * kimliksiz yol, hata sınıfı, maskeli mesajlar, alan ADLARI, tek yönlü kiracı özeti. Gövde, başlık, query
 * değeri, IP ve alan değeri YAZILMAZ. Kapatma: LOG_4XX=false. Loglama yanıtı asla bozmaz.
 */
const logClientError = (
    req: Request,
    status: number,
    error: string,
    serialized: { message?: unknown; field?: unknown }[]
): void => {
    if (!isClientErrorLoggingEnabled()) {
        return;
    }
    try {
        const fields = serialized
            .map((e) => e.field)
            .filter((f): f is string => typeof f === 'string')
            .slice(0, MAX_4XX_MESSAGES * 3);
        logger.warn('HTTP 4xx', {
            status,
            method: req.method,
            path: requestPath(req).replace(OBJECT_ID_SEGMENT, '/:id'),
            error,
            messages: serialized.slice(0, MAX_4XX_MESSAGES).map((e) => maskClientMessage(e.message)),
            ...(fields.length > 0 ? { fields } : {}),
            tenant: hashTenantId((req as Request & { currentUser?: { id?: unknown } }).currentUser?.id)
        });
    } catch {
        // Log satırı kurulamazsa yanıt yine gider.
    }
};

export const errorHandler = (
    err: unknown,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (err instanceof CustomError) {
        const serialized = err.serializeErrors();
        logClientError(req, err.statusCode, err.constructor.name, serialized);
        return res.status(err.statusCode).send({ errors: serialized });
    }

    // body-parser gövde limiti aşıldığında 413 fırlatır; 400'e çevirmek istemcinin gerçek nedeni görmesini engeller (UC-1175)
    // `throw null` / `throw 'x'` reach here too: read `type` only from an object (UC-832 B4)
    if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.too.large') {
        const serialized = [{ message: 'Request body too large' }];
        logClientError(req, 413, 'PayloadTooLargeError', serialized);
        return res.status(413).send({ errors: serialized });
    }

    // console.error printed the raw error: an AxiosError dump carries the request headers (UC-832)
    const path = requestPath(req);
    // A thrown non-Error (string, number, null) has no logger-side message, so its text is appended masked (UC-832 B3)
    if (err instanceof Error || (typeof err === 'object' && err !== null)) {
        logger.error(`Unhandled error on ${req.method} ${path}:`, err);
    } else {
        logger.error(`Unhandled error on ${req.method} ${path}: ${maskErrorText(String(err))}`);
    }
    res.status(400).send({
        errors: [{ message: 'Something went wrong' }]
    });
};
