import { Request, Response, NextFunction } from 'express';
import { NotAuthorizedError } from '../errors/not-authorized-error';
import { UserRole } from '../types/user-role';

export const requireAuthAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.currentUser) {
        throw new NotAuthorizedError();
    }

    if (req.currentUser.role != UserRole.Admin) {
        throw new NotAuthorizedError();
    }

    next();
};
