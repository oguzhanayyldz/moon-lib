"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireActiveSubscription = void 0;
const not_authorized_error_1 = require("../errors/not-authorized-error");
const user_role_1 = require("../types/user-role");
const requireActiveSubscription = (options = {}) => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
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
                const cached = yield redisWrapper.client.get(cacheKey);
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
    });
};
exports.requireActiveSubscription = requireActiveSubscription;
