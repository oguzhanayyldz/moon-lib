import { Request, Response, NextFunction } from 'express';
import { CustomError } from '../errors/custom-error';
import { logger } from '../../services/logger.service';
import { maskErrorText, sanitizeRequestUrl } from '../../utils/logSafety.util';

export const errorHandler = (
    err: unknown,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (err instanceof CustomError) {
        return res.status(err.statusCode).send({ errors: err.serializeErrors() });
    }

    // body-parser gövde limiti aşıldığında 413 fırlatır; 400'e çevirmek istemcinin gerçek nedeni görmesini engeller (UC-1175)
    // `throw null` / `throw 'x'` reach here too: read `type` only from an object (UC-832 B4)
    if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.too.large') {
        return res.status(413).send({ errors: [{ message: 'Request body too large' }] });
    }

    // console.error printed the raw error: an AxiosError dump carries the request headers (UC-832)
    const path = typeof req.originalUrl === 'string' ? sanitizeRequestUrl(req.originalUrl) : '';
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
