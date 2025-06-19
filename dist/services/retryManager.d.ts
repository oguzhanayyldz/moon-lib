export interface RetryConfig {
    maxRetries: number;
    ttlSeconds: number;
    backoffFactor: number;
}
export declare class RetryManager {
    private readonly redisClient;
    private readonly keyPrefix;
    private readonly defaultConfig;
    private readonly config;
    constructor(config?: Partial<RetryConfig>);
    /**
     * Bir olayın retry sayısını al
     */
    getRetryCount(eventType: string, eventId: string): Promise<number>;
    /**
     * Retry sayısını artır ve yeni değeri döndür
     */
    incrementRetryCount(eventType: string, eventId: string): Promise<number>;
    /**
     * Retry sayacını sıfırla
     */
    resetRetryCount(eventType: string, eventId: string): Promise<void>;
    /**
     * Max retry sayısını kontrol et
     */
    shouldRetry(eventType: string, eventId: string): Promise<boolean>;
    /**
     * Exponential backoff ile TTL hesapla
     */
    private calculateTTL;
    /**
     * Bir sonraki deneme için bekleme süresini hesapla (ms cinsinden)
     */
    calculateBackoffDelay(retryCount: number): number;
}
