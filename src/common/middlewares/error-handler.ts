import { Request, Response, NextFunction } from 'express';
import { CustomError } from '../errors/custom-error';
import { logger } from '../../services/logger.service';
import { sanitizeRequestUrl } from '../../utils/logSafety.util';

export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (err instanceof CustomError) {
        return res.status(err.statusCode).send({ errors: err.serializeErrors() });
    }

    // body-parser gövde limiti aşıldığında 413 fırlatır; 400'e çevirmek istemcinin gerçek nedeni görmesini engeller (UC-1175)
    if ((err as Error & { type?: string }).type === 'entity.too.large') {
        return res.status(413).send({ errors: [{ message: 'Request body too large' }] });
    }

    // console.error printed the raw error: an AxiosError dump carries the request headers (UC-832)
    const path = typeof req.originalUrl === 'string' ? sanitizeRequestUrl(req.originalUrl) : '';
    logger.error(`Unhandled error on ${req.method} ${path}:`, err);
    res.status(400).send({
        errors: [{ message: 'Something went wrong' }]
    });
};
