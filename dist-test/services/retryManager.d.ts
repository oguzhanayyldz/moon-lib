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
    /**
     * Retry'ı planla - Redis'te delayed retry key'i oluştur
     */
    scheduleRetry(eventType: string, eventId: string, delayMs: number): Promise<void>;
    /**
     * Planlanmış retry'ı kontrol et
     */
    isRetryScheduled(eventType: string, eventId: string): Promise<boolean>;
    /**
     * Planlanmış retry'ı temizle
     */
    clearScheduledRetry(eventType: string, eventId: string): Promise<void>;
}
//# sourceMappingURL=retryManager.d.ts.map