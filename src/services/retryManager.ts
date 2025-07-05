import { RedisClientType } from 'redis';
import { redisWrapper } from './redisWrapper.service';

export interface RetryConfig {
    maxRetries: number;
    ttlSeconds: number;
    backoffFactor: number;
}

export class RetryManager {
    private readonly redisClient: RedisClientType;
    private readonly keyPrefix: string = 'event:retry:';
    private readonly defaultConfig: RetryConfig = {
        maxRetries: 5,
        ttlSeconds: 86400, // 24 saat
        backoffFactor: 2
    };
    private readonly config: RetryConfig;

    constructor (config?: Partial<RetryConfig>) {
        this.redisClient = redisWrapper.client;
        this.config = { ...this.defaultConfig, ...config };
    }

    /**
     * Bir olayın retry sayısını al
     */
    async getRetryCount(eventType: string, eventId: string): Promise<number> {
        const key = `${this.keyPrefix}${eventType}:${eventId}`;
        const count = await this.redisClient.get(key);
        return count ? parseInt(count, 10) : 0;
    }

    /**
     * Retry sayısını artır ve yeni değeri döndür
     */
    async incrementRetryCount(eventType: string, eventId: string): Promise<number> {
        const key = `${this.keyPrefix}${eventType}:${eventId}`;
        const retryCount = await this.getRetryCount(eventType, eventId);
        const newCount = retryCount + 1;

        await this.redisClient.set(key, newCount.toString(), {
            EX: this.calculateTTL(newCount)
        });

        return newCount;
    }

    /**
     * Retry sayacını sıfırla
     */
    async resetRetryCount(eventType: string, eventId: string): Promise<void> {
        const key = `${this.keyPrefix}${eventType}:${eventId}`;
        await this.redisClient.del(key);
    }

    /**
     * Max retry sayısını kontrol et
     */
    async shouldRetry(eventType: string, eventId: string): Promise<boolean> {
        const retryCount = await this.getRetryCount(eventType, eventId);
        return retryCount < this.config.maxRetries;
    }

    /**
     * Exponential backoff ile TTL hesapla
     */
    private calculateTTL(retryCount: number): number {
        return Math.min(
            this.config.ttlSeconds * Math.pow(this.config.backoffFactor, retryCount - 1),
            this.config.ttlSeconds * 24 // Max 24 gün
        );
    }

    /**
     * Bir sonraki deneme için bekleme süresini hesapla (ms cinsinden)
     */
    calculateBackoffDelay(retryCount: number): number {
        return Math.min(
            1000 * Math.pow(this.config.backoffFactor, retryCount - 1), // 1s, 2s, 4s, 8s, ...
            30000 // Max 30 saniye
        );
    }

    /**
     * Retry'ı planla - Redis'te delayed retry key'i oluştur
     */
    async scheduleRetry(eventType: string, eventId: string, delayMs: number): Promise<void> {
        const scheduleKey = `${this.keyPrefix}scheduled:${eventType}:${eventId}`;
        const nextRetryAt = Date.now() + delayMs;
        
        await this.redisClient.set(scheduleKey, nextRetryAt.toString(), {
            EX: Math.ceil(delayMs / 1000) + 60 // Delay + 1 dakika buffer
        });
    }

    /**
     * Planlanmış retry'ı kontrol et
     */
    async isRetryScheduled(eventType: string, eventId: string): Promise<boolean> {
        const scheduleKey = `${this.keyPrefix}scheduled:${eventType}:${eventId}`;
        const nextRetryAt = await this.redisClient.get(scheduleKey);
        
        if (!nextRetryAt) return false;
        
        const now = Date.now();
        const scheduledTime = parseInt(nextRetryAt, 10);
        
        return now < scheduledTime;
    }

    /**
     * Planlanmış retry'ı temizle
     */
    async clearScheduledRetry(eventType: string, eventId: string): Promise<void> {
        const scheduleKey = `${this.keyPrefix}scheduled:${eventType}:${eventId}`;
        await this.redisClient.del(scheduleKey);
    }
}