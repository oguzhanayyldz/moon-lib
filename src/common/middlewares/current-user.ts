import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '../types/user-role';

interface UserPayload {
    id: string;
    email: string;
    name: string;
    surname: string;
    parentUser: string;
    role: UserRole;
    sessionId?: string; // Added sessionId for session tracking
    isImpersonating?: boolean;
}

declare global {
    namespace Express {
        interface Request {
            currentUser?: UserPayload;
        }
    }
}

export const currentUser = (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.jwt) {
        return next();
    }

    try {
        const payload = jwt.verify(req.session.jwt, process.env.JWT_KEY!) as UserPayload;
        req.currentUser = payload;
    } catch (err) {}

    next();
};
