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
    getRetryCount(eventType, eventId) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `${this.keyPrefix}${eventType}:${eventId}`;
            const count = yield this.redisClient.get(key);
            return count ? parseInt(count, 10) : 0;
        });
    }
    /**
     * Retry sayısını artır ve yeni değeri döndür
     */
    incrementRetryCount(eventType, eventId) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `${this.keyPrefix}${eventType}:${eventId}`;
            const retryCount = yield this.getRetryCount(eventType, eventId);
            const newCount = retryCount + 1;
            yield this.redisClient.set(key, newCount.toString(), {
                EX: this.calculateTTL(newCount)
            });
            return newCount;
        });
    }
    /**
     * Retry sayacını sıfırla
     */
    resetRetryCount(eventType, eventId) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `${this.keyPrefix}${eventType}:${eventId}`;
            yield this.redisClient.del(key);
        });
    }
    /**
     * Max retry sayısını kontrol et
     */
    shouldRetry(eventType, eventId) {
        return __awaiter(this, void 0, void 0, function* () {
            const retryCount = yield this.getRetryCount(eventType, eventId);
            return retryCount < this.config.maxRetries;
        });
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
}
exports.RetryManager = RetryManager;
