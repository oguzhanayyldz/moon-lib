"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseIntegration = void 0;
const integrationCache_service_1 = require("../../services/integrationCache.service");
const redisWrapper_service_1 = require("../../services/redisWrapper.service");
const logger_service_1 = require("../../services/logger.service");
class BaseIntegration {
    constructor() {
        this.credentials = this.getDefaultCredentials();
    }
    validateSetupRequirements() {
        //Her entegrasyonda olması gereken ortak alanların kontrolü
        const requiredFields = ['user', 'platform', 'integration_active'];
        for (const field of requiredFields) {
            if (!this.credentials[field]) {
                throw new Error(`${field} is required`);
            }
        }
        if (!this.credentials) {
            throw new Error('Credentials are required');
        }
        if (!this.credentials.integration_active) {
            throw new Error('Integration is not active');
        }
        // Platform-specific validations
        this.validatePlatformCredentials();
    }
    async setup(user, platform, credentials) {
        if (credentials) {
            this.credentials = Object.assign(Object.assign(Object.assign({}, this.getDefaultCredentials()), credentials), { user,
                platform });
        }
        else {
            this.credentials.user = user;
            this.credentials.platform = platform;
        }
        this.validateSetupRequirements();
        await this.connect();
        return this;
    }
    getIntegrationType() {
        return this.type;
    }
    getPlatformName() {
        return this.platform;
    }
    getCredentials() {
        return this.credentials;
    }
    static getOrCreateCache(className) {
        if (!this.cacheMap.has(className)) {
            this.cacheMap.set(className, new integrationCache_service_1.IntegrationCacheService(className, {
                max: 1000,
                ttl: 1000 * 60 * 60 // 1 hour
            }));
        }
        return this.cacheMap.get(className);
    }
    static getFromCache(userId, platformId) {
        const cache = BaseIntegration.getOrCreateCache(this.name);
        return cache.get(`${userId}-${platformId}`);
    }
    static addToCache(userId, platformId, instance) {
        const cache = BaseIntegration.getOrCreateCache(this.name);
        cache.set(`${userId}-${platformId}`, instance);
    }
    static invalidateCache(userId, platformId) {
        const cache = BaseIntegration.getOrCreateCache(this.name);
        cache.invalidate(`${userId}-${platformId}`);
        redisWrapper_service_1.redisWrapper.client.del(`integration:${userId}:${platformId}:tokens`)
            .catch(err => logger_service_1.logger.error('Failed to delete tokens from Redis', { err }));
    }
    static invalidateUserCache(userId) {
        const cache = BaseIntegration.getOrCreateCache(this.name);
        cache.invalidateUser(userId);
        redisWrapper_service_1.redisWrapper.client.keys(`integration:${userId}:*:tokens`)
            .then(keys => {
            if (keys.length > 0) {
                return redisWrapper_service_1.redisWrapper.client.del(keys);
            }
        })
            .catch(err => logger_service_1.logger.error('Failed to delete user tokens from Redis', { err }));
    }
    static getCacheStats() {
        const cache = BaseIntegration.getOrCreateCache(this.name);
        return cache.getStats();
    }
}
exports.BaseIntegration = BaseIntegration;
// ===== CENTRALIZED STATIC CACHE SYSTEM =====
BaseIntegration.cacheMap = new Map();
//# sourceMappingURL=base-integration.js.map