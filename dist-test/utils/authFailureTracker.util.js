"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthFailureTracker = void 0;
const redisWrapper_service_1 = require("../services/redisWrapper.service");
const logger_service_1 = require("../services/logger.service");
const outbox_schema_1 = require("../models/outbox.schema");
const subjects_1 = require("../common/events/subjects");
const optimisticLocking_util_1 = require("./optimisticLocking.util");
/**
 * Entegrasyon API client'larinda ardisik 401/403 auth hatalarini takip eder.
 * Threshold asildiginda IntegrationAuthFailureExceededEvent publish edilir (Outbox).
 * Basarili bir cagri sayaci sifirlar.
 *
 * Redis key: integration:auth-failures:{userId}:{integrationId} (TTL 24 saat)
 */
class AuthFailureTracker {
    /**
     * Servis startup'inda cagrilir — Outbox event publish'i icin mongoose connection'i inject eder.
     * moon-lib pattern (retryableListener, eventPublisherJob) ile tutarli: explicit connection injection.
     */
    static initialize(connection) {
        AuthFailureTracker.connection = connection;
    }
    static getKey(userId, integrationId) {
        return `integration:auth-failures:${userId}:${integrationId}`;
    }
    /**
     * 401/403 aldiginda counter'i artir, threshold asilirsa event publish et.
     * @returns Guncel counter degeri (Redis hatasi durumunda 0)
     */
    static async increment(context, lastErrorStatus, lastErrorMessage) {
        var _a;
        const key = AuthFailureTracker.getKey(context.userId, context.integrationId);
        let count = 0;
        try {
            count = await redisWrapper_service_1.redisWrapper.client.incr(key);
            // Yeni key olusturulduysa TTL ayarla (sadece ilk increment'te)
            if (count === 1) {
                await redisWrapper_service_1.redisWrapper.client.expire(key, AuthFailureTracker.TTL_SECONDS);
            }
        }
        catch (redisError) {
            logger_service_1.logger.warn('AuthFailureTracker: Redis increment failed, skipping tracking', {
                error: redisError.message,
                userId: context.userId,
                integrationId: context.integrationId
            });
            return 0;
        }
        const threshold = (_a = context.threshold) !== null && _a !== void 0 ? _a : AuthFailureTracker.DEFAULT_THRESHOLD;
        logger_service_1.logger.warn(`AuthFailureTracker: auth failure recorded for ${context.integrationName}`, {
            userId: context.userId,
            integrationId: context.integrationId,
            count,
            threshold,
            status: lastErrorStatus
        });
        if (count >= threshold) {
            await AuthFailureTracker.publishExceededEvent(context, count, lastErrorStatus, lastErrorMessage);
        }
        return count;
    }
    /**
     * Basarili bir API call sonrasi counter'i sifirla.
     */
    static async reset(userId, integrationId) {
        const key = AuthFailureTracker.getKey(userId, integrationId);
        try {
            const deleted = await redisWrapper_service_1.redisWrapper.client.del(key);
            if (deleted === 1) {
                logger_service_1.logger.info('AuthFailureTracker: counter reset', { userId, integrationId });
            }
        }
        catch (redisError) {
            logger_service_1.logger.warn('AuthFailureTracker: Redis reset failed', {
                error: redisError.message,
                userId,
                integrationId
            });
        }
    }
    /**
     * Mevcut counter degerini oku (debug/UI icin).
     */
    static async get(userId, integrationId) {
        const key = AuthFailureTracker.getKey(userId, integrationId);
        try {
            const value = await redisWrapper_service_1.redisWrapper.client.get(key);
            return value ? parseInt(value, 10) : 0;
        }
        catch (_a) {
            return 0;
        }
    }
    /**
     * Threshold asildiginda IntegrationAuthFailureExceeded event'ini Outbox'a yaz.
     * AuthFailureTracker.initialize(connection) servis startup'inda cagrilmamissa
     * uyari log'lar ama exception fırlatmaz (API isteklerini kirmaz).
     */
    static async publishExceededEvent(context, failureCount, lastErrorStatus, lastErrorMessage) {
        const connection = AuthFailureTracker.connection;
        if (!connection) {
            logger_service_1.logger.error('AuthFailureTracker: not initialized — call AuthFailureTracker.initialize(mongoose.connection) at service startup', {
                userId: context.userId,
                integrationId: context.integrationId
            });
            return;
        }
        try {
            const Outbox = (0, outbox_schema_1.createOutboxModel)(connection);
            const outboxEvent = Outbox.build({
                eventType: subjects_1.Subjects.IntegrationAuthFailureExceeded,
                payload: {
                    userId: context.userId,
                    integrationId: context.integrationId,
                    integrationName: context.integrationName,
                    failureCount,
                    lastErrorStatus,
                    lastErrorMessage,
                    timestamp: new Date()
                },
                status: 'pending'
            });
            await optimisticLocking_util_1.OptimisticLockingUtil.saveWithRetry(outboxEvent);
            logger_service_1.logger.error(`AuthFailureTracker: THRESHOLD EXCEEDED — IntegrationAuthFailureExceeded event queued`, {
                userId: context.userId,
                integrationId: context.integrationId,
                integrationName: context.integrationName,
                failureCount,
                lastErrorStatus
            });
        }
        catch (error) {
            logger_service_1.logger.error('AuthFailureTracker: Failed to queue IntegrationAuthFailureExceeded event', {
                error: error.message,
                userId: context.userId,
                integrationId: context.integrationId
            });
        }
    }
}
exports.AuthFailureTracker = AuthFailureTracker;
AuthFailureTracker.DEFAULT_THRESHOLD = 5;
AuthFailureTracker.TTL_SECONDS = 86400; // 24 saat
//# sourceMappingURL=authFailureTracker.util.js.map