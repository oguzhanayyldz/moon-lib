"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const custom_error_1 = require("../errors/custom-error");
const logger_service_1 = require("../../services/logger.service");
const logSafety_util_1 = require("../../utils/logSafety.util");
// UC-2365: bir 4xx/5xx satırına en çok bu kadar mesaj ve mesaj başına bu kadar karakter girer.
const MAX_LOGGED_MESSAGES = 3;
const MAX_LOGGED_MESSAGE_LENGTH = 200;
// 24 haneli hex (Mongo ObjectId) yol parçası: kimlik satıra yazılmaz, `:id` olur (Loki'de kardinalite de düşer).
const OBJECT_ID_SEGMENT = /\/[0-9a-fA-F]{24}(?=\/|$)/g;
// UC-2412: URL kodlu `@` (`ali%40x.com`) çözülmeden e-posta şekli görünmez.
const ENCODED_AT = /%40/gi;
const isClientErrorLoggingEnabled = () => {
    var _a;
    const setting = ((_a = process.env.LOG_4XX) !== null && _a !== void 0 ? _a : '').trim().toLowerCase();
    return setting !== '0' && setting !== 'false';
};
const requestPath = (req) => typeof req.originalUrl === 'string' ? (0, logSafety_util_1.sanitizeRequestUrl)(req.originalUrl) : '';
/**
 * UC-2412: serbest metin (hata mesajı, alan adı) için tam maske. Sıra önemli:
 * 1) TC/IBAN önce: telefon kalıbı IBAN'ın rakam gruplarını parçalayıp tanınmaz bırakmasın;
 * 2) kişisel veri: `maskErrorText`'in URI kuralı `ali@x.com`'u userinfo sanıp yalnız yerel kısmı keser;
 * 3) `maskErrorText`: `password=`, `apiKey=`, JSON parola alanı, `Name: değer`, JWT, Bearer, URI parolası.
 */
const maskFreeText = (value) => (0, logSafety_util_1.maskErrorText)((0, logSafety_util_1.redactPersonalDataText)((0, logSafety_util_1.redactNationalIdAndIbanPatterns)(String(value !== null && value !== void 0 ? value : '').replace(ENCODED_AT, '@'))));
const maskMessage = (message) => {
    const masked = maskFreeText(message);
    return masked.length > MAX_LOGGED_MESSAGE_LENGTH ? `${masked.slice(0, MAX_LOGGED_MESSAGE_LENGTH - 1)}…` : masked;
};
// UC-2412: yol parçasında e-posta/JWT/TC/IBAN da olabilir (bot ya da saldırgan yolu). Yol bir `name=değer`
// metni değildir; yalnız şekil kuralları uygulanır.
const maskPath = (req) => (0, logSafety_util_1.maskLogMessageText)((0, logSafety_util_1.redactPersonalDataPatterns)((0, logSafety_util_1.redactNationalIdAndIbanPatterns)(requestPath(req).replace(ENCODED_AT, '@').replace(OBJECT_ID_SEGMENT, '/:id'))));
/**
 * UC-2365: bir CustomError yanıtını tek satır yazar. 4xx → `warn 'HTTP 4xx'` (kapatma: LOG_4XX=false);
 * 5xx → `error 'HTTP 5xx'` (UC-2412: 5xx eskiden "HTTP 4xx" etiketiyle yazılıyordu; her zaman açık).
 * Yazılanlar: durum, yöntem, query'siz ve kimliksiz yol, hata sınıfı, maskeli mesajlar, maskeli alan ADLARI,
 * tek yönlü kiracı özeti. Gövde, başlık, query değeri, IP, alan değeri ve `details` YAZILMAZ.
 * Loglama yanıtı asla bozmaz.
 */
const logCustomError = (req, status, error, serialized) => {
    var _a;
    const isServerError = status >= 500;
    if (!isServerError && !isClientErrorLoggingEnabled()) {
        return;
    }
    try {
        const fields = serialized
            .map((e) => e.field)
            .filter((f) => typeof f === 'string')
            .slice(0, MAX_LOGGED_MESSAGES * 3)
            .map(maskMessage);
        const meta = Object.assign(Object.assign({ status, method: req.method, path: maskPath(req), error, messages: serialized.slice(0, MAX_LOGGED_MESSAGES).map((e) => maskMessage(e.message)) }, (fields.length > 0 ? { fields } : {})), { tenant: (0, logSafety_util_1.hashTenantId)((_a = req.currentUser) === null || _a === void 0 ? void 0 : _a.id) });
        if (isServerError) {
            logger_service_1.logger.error('HTTP 5xx', meta);
        }
        else {
            logger_service_1.logger.warn('HTTP 4xx', meta);
        }
    }
    catch (_b) {
        // Log satırı kurulamazsa yanıt yine gider.
    }
};
const errorHandler = (err, req, res, next) => {
    if (err instanceof custom_error_1.CustomError) {
        const serialized = err.serializeErrors();
        logCustomError(req, err.statusCode, err.constructor.name, serialized);
        return res.status(err.statusCode).send({ errors: serialized });
    }
    // body-parser gövde limiti aşıldığında 413 fırlatır; 400'e çevirmek istemcinin gerçek nedeni görmesini engeller (UC-1175)
    // `throw null` / `throw 'x'` reach here too: read `type` only from an object (UC-832 B4)
    if (typeof err === 'object' && err !== null && err.type === 'entity.too.large') {
        const serialized = [{ message: 'Request body too large' }];
        logCustomError(req, 413, 'PayloadTooLargeError', serialized);
        return res.status(413).send({ errors: serialized });
    }
    // console.error printed the raw error: an AxiosError dump carries the request headers (UC-832)
    const path = requestPath(req);
    // A thrown non-Error (string, number, null) has no logger-side message, so its text is appended masked (UC-832 B3)
    if (err instanceof Error || (typeof err === 'object' && err !== null)) {
        logger_service_1.logger.error(`Unhandled error on ${req.method} ${path}:`, err);
    }
    else {
        logger_service_1.logger.error(`Unhandled error on ${req.method} ${path}: ${(0, logSafety_util_1.maskErrorText)(String(err))}`);
    }
    res.status(400).send({
        errors: [{ message: 'Something went wrong' }]
    });
};
exports.errorHandler = errorHandler;
