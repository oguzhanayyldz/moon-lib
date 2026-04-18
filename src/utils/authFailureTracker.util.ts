import mongoose from 'mongoose';
import { redisWrapper } from '../services/redisWrapper.service';
import { logger } from '../services/logger.service';
import { createOutboxModel } from '../models/outbox.schema';
import { Subjects } from '../common/events/subjects';
import { OptimisticLockingUtil } from './optimisticLocking.util';

export interface AuthFailureTrackerContext {
    userId: string;
    integrationId: string;
    integrationName: string;
    threshold?: number;
}

/**
 * Entegrasyon API client'larinda ardisik 401/403 auth hatalarini takip eder.
 * Threshold asildiginda IntegrationAuthFailureExceededEvent publish edilir (Outbox).
 * Basarili bir cagri sayaci sifirlar.
 *
 * Redis key: integration:auth-failures:{userId}:{integrationId} (TTL 24 saat)
 */
export class AuthFailureTracker {
    private static readonly DEFAULT_THRESHOLD = 5;
    private static readonly TTL_SECONDS = 86400; // 24 saat
    private static connection?: mongoose.Connection;

    /**
     * Servis startup'inda cagrilir — Outbox event publish'i icin mongoose connection'i inject eder.
     * moon-lib pattern (retryableListener, eventPublisherJob) ile tutarli: explicit connection injection.
     */
    static initialize(connection: mongoose.Connection): void {
        AuthFailureTracker.connection = connection;
    }

    static getKey(userId: string, integrationId: string): string {
        return `integration:auth-failures:${userId}:${integrationId}`;
    }

    /**
     * 401/403 aldiginda counter'i artir, threshold asilirsa event publish et.
     * @returns Guncel counter degeri (Redis hatasi durumunda 0)
     */
    static async increment(
        context: AuthFailureTrackerContext,
        lastErrorStatus: 401 | 403,
        lastErrorMessage?: string
    ): Promise<number> {
        const key = AuthFailureTracker.getKey(context.userId, context.integrationId);
        let count = 0;

        try {
            count = await redisWrapper.client.incr(key);
            // Yeni key olusturulduysa TTL ayarla (sadece ilk increment'te)
            if (count === 1) {
                await redisWrapper.client.expire(key, AuthFailureTracker.TTL_SECONDS);
            }
        } catch (redisError) {
            logger.warn('AuthFailureTracker: Redis increment failed, skipping tracking', {
                error: (redisError as Error).message,
                userId: context.userId,
                integrationId: context.integrationId
            });
            return 0;
        }

        const threshold = context.threshold ?? AuthFailureTracker.DEFAULT_THRESHOLD;
        logger.warn(`AuthFailureTracker: auth failure recorded for ${context.integrationName}`, {
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
    static async reset(userId: string, integrationId: string): Promise<void> {
        const key = AuthFailureTracker.getKey(userId, integrationId);
        try {
            const deleted = await redisWrapper.client.del(key);
            if (deleted === 1) {
                logger.info('AuthFailureTracker: counter reset', { userId, integrationId });
            }
        } catch (redisError) {
            logger.warn('AuthFailureTracker: Redis reset failed', {
                error: (redisError as Error).message,
                userId,
                integrationId
            });
        }
    }

    /**
     * Mevcut counter degerini oku (debug/UI icin).
     */
    static async get(userId: string, integrationId: string): Promise<number> {
        const key = AuthFailureTracker.getKey(userId, integrationId);
        try {
            const value = await redisWrapper.client.get(key);
            return value ? parseInt(value, 10) : 0;
        } catch {
            return 0;
        }
    }

    /**
     * Threshold asildiginda IntegrationAuthFailureExceeded event'ini Outbox'a yaz.
     * AuthFailureTracker.initialize(connection) servis startup'inda cagrilmamissa
     * uyari log'lar ama exception fırlatmaz (API isteklerini kirmaz).
     */
    private static async publishExceededEvent(
        context: AuthFailureTrackerContext,
        failureCount: number,
        lastErrorStatus: 401 | 403,
        lastErrorMessage?: string
    ): Promise<void> {
        const connection = AuthFailureTracker.connection;
        if (!connection) {
            logger.error('AuthFailureTracker: not initialized — call AuthFailureTracker.initialize(mongoose.connection) at service startup', {
                userId: context.userId,
                integrationId: context.integrationId
            });
            return;
        }

        try {
            const Outbox = createOutboxModel(connection);
            const outboxEvent = Outbox.build({
                eventType: Subjects.IntegrationAuthFailureExceeded,
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
            await OptimisticLockingUtil.saveWithRetry(outboxEvent);

            logger.error(`AuthFailureTracker: THRESHOLD EXCEEDED — IntegrationAuthFailureExceeded event queued`, {
                userId: context.userId,
                integrationId: context.integrationId,
                integrationName: context.integrationName,
                failureCount,
                lastErrorStatus
            });
        } catch (error) {
            logger.error('AuthFailureTracker: Failed to queue IntegrationAuthFailureExceeded event', {
                error: (error as Error).message,
                userId: context.userId,
                integrationId: context.integrationId
            });
        }
    }
}
