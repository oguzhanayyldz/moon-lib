import { Request, Response, NextFunction } from 'express';
import { NotAuthorizedError } from '../errors/not-authorized-error';

export const requireEmailVerified = (req: Request, res: Response, next: NextFunction) => {
    if (!req.currentUser) {
        throw new NotAuthorizedError();
    }

    // Strict false check: undefined/null geçer (eski kullanıcılar etkilenmez)
    if (req.currentUser.emailVerified === false) {
        throw new NotAuthorizedError('EMAIL_NOT_VERIFIED');
    }

    next();
};
