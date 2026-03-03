import { Request, Response, NextFunction } from 'express';
import { NotAuthorizedError } from '../errors/not-authorized-error';
import { UserRole } from '../types/user-role';

interface RequireActiveSubscriptionOptions {
    allowRead?: boolean;
}

export const requireActiveSubscription = (options: RequireActiveSubscriptionOptions = {}) => {
    return async (req: Request, res: Response, next: NextFunction) => {
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

        // allowRead: GET istekleri muaf
        if (options.allowRead && req.method === 'GET') {
            return next();
        }

        try {
            // Redis'ten subscription status kontrol et
            const { redisWrapper } = require('../../services/redisWrapper.service');
            if (redisWrapper && redisWrapper.client) {
                const cacheKey = `sub:status:${req.currentUser.id}`;
                const cached = await redisWrapper.client.get(cacheKey);

                if (cached) {
                    const status = JSON.parse(cached);
                    if (status.status === 'active' || status.status === 'trial') {
                        return next();
                    }
                    throw new NotAuthorizedError('SUBSCRIPTION_REQUIRED');
                }
            }

            // Redis'te veri yok veya Redis erişilemez → graceful degradation (izin ver)
            next();
        } catch (error) {
            // NotAuthorizedError ise throw et
            if (error instanceof NotAuthorizedError) {
                throw error;
            }
            // Redis hata → graceful degradation (izin ver)
            next();
        }
    };
};
