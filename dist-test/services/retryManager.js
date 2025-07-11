"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryManager = void 0;
const redisWrapper_service_1 = require("./redisWrapper.service");
class RetryManager {
    constructor(config) {
        this.keyPrefix = 'event:retry:';
        this.defaultConfig = {
            maxRetries: 5,
            ttlSeconds: 86400, // 24 saat
            backoffFactor: 2
        };
        this.redisClient = redisWrapper_service_1.redisWrapper.client;
        this.config = Object.assign(Object.assign({}, this.defaultConfig), config);
    }
    /**
     * Bir olayın retry sayısını al
     */
    async getRetryCount(eventType, eventId) {
        const key = `${this.keyPrefix}${eventType}:${eventId}`;
        const count = await this.redisClient.get(key);
        return count ? parseInt(count, 10) : 0;
    }
    /**
     * Retry sayısını artır ve yeni değeri döndür
     */
    async incrementRetryCount(eventType, eventId) {
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
    async resetRetryCount(eventType, eventId) {
        const key = `${this.keyPrefix}${eventType}:${eventId}`;
        await this.redisClient.del(key);
    }
    /**
     * Max retry sayısını kontrol et
     */
    async shouldRetry(eventType, eventId) {
        const retryCount = await this.getRetryCount(eventType, eventId);
        return retryCount < this.config.maxRetries;
    }
    /**
     * Exponential backoff ile TTL hesapla
     */
    calculateTTL(retryCount) {
        return Math.min(this.config.ttlSeconds * Math.pow(this.config.backoffFactor, retryCount - 1), this.config.ttlSeconds * 24 // Max 24 gün
        );
    }
    /**
     * Bir sonraki deneme için bekleme süresini hesapla (ms cinsinden)
     */
    calculateBackoffDelay(retryCount) {
        return Math.min(1000 * Math.pow(this.config.backoffFactor, retryCount - 1), // 1s, 2s, 4s, 8s, ...
        30000 // Max 30 saniye
        );
    }
    /**
     * Retry'ı planla - Redis'te delayed retry key'i oluştur
     */
    async scheduleRetry(eventType, eventId, delayMs) {
        const scheduleKey = `${this.keyPrefix}scheduled:${eventType}:${eventId}`;
        const nextRetryAt = Date.now() + delayMs;
        await this.redisClient.set(scheduleKey, nextRetryAt.toString(), {
            EX: Math.ceil(delayMs / 1000) + 60 // Delay + 1 dakika buffer
        });
    }
    /**
     * Planlanmış retry'ı kontrol et
     */
    async isRetryScheduled(eventType, eventId) {
        const scheduleKey = `${this.keyPrefix}scheduled:${eventType}:${eventId}`;
        const nextRetryAt = await this.redisClient.get(scheduleKey);
        if (!nextRetryAt)
            return false;
        const now = Date.now();
        const scheduledTime = parseInt(nextRetryAt, 10);
        return now < scheduledTime;
    }
    /**
     * Planlanmış retry'ı temizle
     */
    async clearScheduledRetry(eventType, eventId) {
        const scheduleKey = `${this.keyPrefix}scheduled:${eventType}:${eventId}`;
        await this.redisClient.del(scheduleKey);
    }
}
exports.RetryManager = RetryManager;
//# sourceMappingURL=retryManager.js.map