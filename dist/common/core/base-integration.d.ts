export declare abstract class BaseIntegration {
    protected credentials: any;
    protected type: string | undefined;
    protected platform: string | undefined;
    constructor();
    protected abstract getDefaultCredentials(): any;
    protected abstract validatePlatformCredentials(): void;
    protected abstract connect(): Promise<void>;
    validateSetupRequirements(): void;
    setup(user: string, platform: string, credentials?: any): Promise<BaseIntegration>;
    getIntegrationType(): string | undefined;
    getPlatformName(): string | undefined;
    getCredentials(): any;
    private static cacheMap;
    private static getOrCreateCache;
    static getFromCache<T extends BaseIntegration>(this: (new () => T) & typeof BaseIntegration, userId: string, platformId: string): T | undefined;
    static addToCache<T extends BaseIntegration>(this: (new () => T) & typeof BaseIntegration, userId: string, platformId: string, instance: T): void;
    static invalidateCache(userId: string, platformId: string): void;
    static invalidateUserCache(userId: string): void;
    static getCacheStats(): {
        size: number;
        max: number;
        ttl: number;
        calculatedSize: number;
    };
}
