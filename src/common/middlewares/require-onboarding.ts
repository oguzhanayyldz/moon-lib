import { Request, Response, NextFunction } from 'express';
import { NotAuthorizedError } from '../errors/not-authorized-error';
import { UserRole } from '../types/user-role';

export const requireOnboarding = (req: Request, res: Response, next: NextFunction) => {
    if (!req.currentUser) {
        throw new NotAuthorizedError();
    }

    // Admin ve SubUser muaf
    const roleNumber = Number(req.currentUser.role);
    if (roleNumber === UserRole.Admin || roleNumber === UserRole.SubUser) {
        return next();
    }

    // SubUser mode'da muaf
    if (req.currentUser.isSubUserMode) {
        return next();
    }

    // Strict false check: undefined/null geçer (eski kullanıcılar etkilenmez)
    if (req.currentUser.onboardingCompleted === false) {
        throw new NotAuthorizedError('ONBOARDING_REQUIRED');
    }

    next();
};
