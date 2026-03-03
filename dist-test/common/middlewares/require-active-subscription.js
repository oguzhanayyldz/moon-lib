"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireActiveSubscription = void 0;
const not_authorized_error_1 = require("../errors/not-authorized-error");
const user_role_1 = require("../types/user-role");
const requireActiveSubscription = (options = {}) => {
    return async (req, res, next) => {
        if (!req.currentUser) {
            throw new not_authorized_error_1.NotAuthorizedError();
        }
        // Admin ve SubUser muaf
        const roleNumber = Number(req.currentUser.role);
        if (roleNumber === user_role_1.UserRole.Admin || roleNumber === user_role_1.UserRole.SubUser) {
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
                    throw new not_authorized_error_1.NotAuthorizedError('SUBSCRIPTION_REQUIRED');
                }
            }
            // Redis'te veri yok veya Redis erişilemez → graceful degradation (izin ver)
            next();
        }
        catch (error) {
            // NotAuthorizedError ise throw et
            if (error instanceof not_authorized_error_1.NotAuthorizedError) {
                throw error;
            }
            // Redis hata → graceful degradation (izin ver)
            next();
        }
    };
};
exports.requireActiveSubscription = requireActiveSubscription;
//# sourceMappingURL=require-active-subscription.js.map