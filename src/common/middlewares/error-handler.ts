import { Request, Response, NextFunction } from 'express';
import { CustomError } from '../errors/custom-error';
import { logger } from '../../services/logger.service';
import {
    hashTenantId,
    maskErrorText,
    maskLogMessageText,
    redactNationalIdAndIbanPatterns,
    redactPersonalDataPatterns,
    redactPersonalDataText,
    sanitizeRequestUrl
} from '../../utils/logSafety.util';

// UC-2365: bir 4xx/5xx satırına en çok bu kadar mesaj ve mesaj başına bu kadar karakter girer.
const MAX_LOGGED_MESSAGES = 3;
const MAX_LOGGED_MESSAGE_LENGTH = 200;
// 24 haneli hex (Mongo ObjectId) yol parçası: kimlik satıra yazılmaz, `:id` olur (Loki'de kardinalite de düşer).
const OBJECT_ID_SEGMENT = /\/[0-9a-fA-F]{24}(?=\/|$)/g;
// UC-2412: URL kodlu `@` (`ali%40x.com`) çözülmeden e-posta şekli görünmez.
const ENCODED_AT = /%40/gi;

const isClientErrorLoggingEnabled = (): boolean => {
    const setting = (process.env.LOG_4XX ?? '').trim().toLowerCase();
    return setting !== '0' && setting !== 'false';
};

const requestPath = (req: Request): string =>
    typeof req.originalUrl === 'string' ? sanitizeRequestUrl(req.originalUrl) : '';

/**
 * UC-2412: serbest metin (hata mesajı, alan adı) için tam maske. Sıra önemli:
 * 1) TC/IBAN önce: telefon kalıbı IBAN'ın rakam gruplarını parçalayıp tanınmaz bırakmasın;
 * 2) kişisel veri: `maskErrorText`'in URI kuralı `ali@x.com`'u userinfo sanıp yalnız yerel kısmı keser;
 * 3) `maskErrorText`: `password=`, `apiKey=`, JSON parola alanı, `Name: değer`, JWT, Bearer, URI parolası.
 */
const maskFreeText = (value: unknown): string =>
    maskErrorText(redactPersonalDataText(redactNationalIdAndIbanPatterns(String(value ?? '').replace(ENCODED_AT, '@'))));

const maskMessage = (message: unknown): string => {
    const masked = maskFreeText(message);
    return masked.length > MAX_LOGGED_MESSAGE_LENGTH ? `${masked.slice(0, MAX_LOGGED_MESSAGE_LENGTH - 1)}…` : masked;
};

// UC-2412: yol parçasında e-posta/JWT/TC/IBAN da olabilir (bot ya da saldırgan yolu). Yol bir `name=değer`
// metni değildir; yalnız şekil kuralları uygulanır.
const maskPath = (req: Request): string =>
    maskLogMessageText(
        redactPersonalDataPatterns(
            redactNationalIdAndIbanPatterns(requestPath(req).replace(ENCODED_AT, '@').replace(OBJECT_ID_SEGMENT, '/:id'))
        )
    );

/**
 * UC-2365: bir CustomError yanıtını tek satır yazar. 4xx → `warn 'HTTP 4xx'` (kapatma: LOG_4XX=false);
 * 5xx → `error 'HTTP 5xx'` (UC-2412: 5xx eskiden "HTTP 4xx" etiketiyle yazılıyordu; her zaman açık).
 * Yazılanlar: durum, yöntem, query'siz ve kimliksiz yol, hata sınıfı, maskeli mesajlar, maskeli alan ADLARI,
 * tek yönlü kiracı özeti. Gövde, başlık, query değeri, IP, alan değeri ve `details` YAZILMAZ.
 * Loglama yanıtı asla bozmaz.
 */
const logCustomError = (
    req: Request,
    status: number,
    error: string,
    serialized: { message?: unknown; field?: unknown }[]
): void => {
    const isServerError = status >= 500;
    if (!isServerError && !isClientErrorLoggingEnabled()) {
        return;
    }
    try {
        const fields = serialized
            .map((e) => e.field)
            .filter((f): f is string => typeof f === 'string')
            .slice(0, MAX_LOGGED_MESSAGES * 3)
            .map(maskMessage);
        const meta = {
            status,
            method: req.method,
            path: maskPath(req),
            error,
            messages: serialized.slice(0, MAX_LOGGED_MESSAGES).map((e) => maskMessage(e.message)),
            ...(fields.length > 0 ? { fields } : {}),
            tenant: hashTenantId((req as Request & { currentUser?: { id?: unknown } }).currentUser?.id)
        };
        if (isServerError) {
            logger.error('HTTP 5xx', meta);
        } else {
            logger.warn('HTTP 4xx', meta);
        }
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
        logCustomError(req, err.statusCode, err.constructor.name, serialized);
        return res.status(err.statusCode).send({ errors: serialized });
    }

    // body-parser gövde limiti aşıldığında 413 fırlatır; 400'e çevirmek istemcinin gerçek nedeni görmesini engeller (UC-1175)
    // `throw null` / `throw 'x'` reach here too: read `type` only from an object (UC-832 B4)
    if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.too.large') {
        const serialized = [{ message: 'Request body too large' }];
        logCustomError(req, 413, 'PayloadTooLargeError', serialized);
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
