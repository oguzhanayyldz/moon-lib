import { IntegrationCacheService } from '../../services/integrationCache.service';
import { redisWrapper } from '../../services/redisWrapper.service';
import { logger } from '../../services/logger.service';

export abstract class BaseIntegration {
    protected credentials: any;
    protected type: string | undefined;
    protected platform: string | undefined;

    constructor() {
        this.credentials = this.getDefaultCredentials();
    }

    protected abstract getDefaultCredentials(): any;
    protected abstract validatePlatformCredentials(): void;
    protected abstract connect(): Promise<void>;

    validateSetupRequirements(): void {
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

    async setup(user: string, platform: string, credentials?: any): Promise<BaseIntegration> {
        if (credentials) {
            this.credentials = {
                ...this.getDefaultCredentials(),
                ...credentials,
                user,
                platform
            };
        } else {
            this.credentials.user = user;
            this.credentials.platform = platform;
        }

        this.validateSetupRequirements();
        await this.connect();
        return this;
    }

    getIntegrationType(): string | undefined {
        return this.type;
    }

    getPlatformName(): string | undefined {
        return this.platform;
    }

    getCredentials(): any {
        return this.credentials;
    }

    // ===== CENTRALIZED STATIC CACHE SYSTEM =====
    private static cacheMap = new Map<string, IntegrationCacheService<any>>();

    private static getOrCreateCache(className: string): IntegrationCacheService<any> {
        if (!this.cacheMap.has(className)) {
            this.cacheMap.set(className, new IntegrationCacheService(className, {
                max: 1000,
                ttl: 1000 * 60 * 60 // 1 hour
            }));
        }
        return this.cacheMap.get(className)!;
    }

    static getFromCache<T extends BaseIntegration>(
        this: (new () => T) & typeof BaseIntegration,
        userId: string,
        platformId: string
    ): T | undefined {
        const cache = BaseIntegration.getOrCreateCache(this.name);
        return cache.get(`${userId}-${platformId}`) as T | undefined;
    }

    static addToCache<T extends BaseIntegration>(
        this: (new () => T) & typeof BaseIntegration,
        userId: string,
        platformId: string,
        instance: T
    ): void {
        const cache = BaseIntegration.getOrCreateCache(this.name);
        cache.set(`${userId}-${platformId}`, instance);
    }

    static invalidateCache(userId: string, platformId: string): void {
        const cache = BaseIntegration.getOrCreateCache(this.name);
        cache.invalidate(`${userId}-${platformId}`);
        redisWrapper.client.del(`integration:${userId}:${platformId}:tokens`)
            .catch(err => logger.error('Failed to delete tokens from Redis', { err }));
    }

    static invalidateUserCache(userId: string): void {
        const cache = BaseIntegration.getOrCreateCache(this.name);
        cache.invalidateUser(userId);
        redisWrapper.client.keys(`integration:${userId}:*:tokens`)
            .then(keys => {
                if (keys.length > 0) {
                    return redisWrapper.client.del(keys);
                }
            })
            .catch(err => logger.error('Failed to delete user tokens from Redis', { err }));
    }

    static getCacheStats() {
        const cache = BaseIntegration.getOrCreateCache(this.name);
        return cache.getStats();
    }
}
