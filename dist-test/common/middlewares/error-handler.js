"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const custom_error_1 = require("../errors/custom-error");
const logger_service_1 = require("../../services/logger.service");
const logSafety_util_1 = require("../../utils/logSafety.util");
const errorHandler = (err, req, res, next) => {
    if (err instanceof custom_error_1.CustomError) {
        return res.status(err.statusCode).send({ errors: err.serializeErrors() });
    }
    // body-parser gövde limiti aşıldığında 413 fırlatır; 400'e çevirmek istemcinin gerçek nedeni görmesini engeller (UC-1175)
    // `throw null` / `throw 'x'` reach here too: read `type` only from an object (UC-832 B4)
    if (typeof err === 'object' && err !== null && err.type === 'entity.too.large') {
        return res.status(413).send({ errors: [{ message: 'Request body too large' }] });
    }
    // console.error printed the raw error: an AxiosError dump carries the request headers (UC-832)
    const path = typeof req.originalUrl === 'string' ? (0, logSafety_util_1.sanitizeRequestUrl)(req.originalUrl) : '';
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
//# sourceMappingURL=error-handler.js.map