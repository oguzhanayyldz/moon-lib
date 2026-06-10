import mongoose from 'mongoose';
import { redisWrapper } from '../services/redisWrapper.service';
import { logger } from '../services/logger.service';
import { createOutboxModel } from '../models/outbox.schema';
import { Subjects } from '../common/events/subjects';
import { OperationType } from '../enums/operation-type.enum';
import { OptimisticLockingUtil } from './optimisticLocking.util';

export interface AuthFailureTrackerContext {
    userId: string;
    integrationId: string;
    integrationName: string;
    /** Tek operasyonun auth-failure esigi. Varsayilan: 5 */
    threshold?: number;
    /**
     * Akilli pasiflestirme esigi (issue #566): Entegrasyonu pasife cekmek icin
     * KAC FARKLI operasyon turunun kendi auth esigini asmasi gerektigi. Varsayilan: 2
     */
    deactivationOperationThreshold?: number;
}

/**
 * Entegrasyon API client'larinda ardisik 401/403 auth hatalarini OPERASYON BAZINDA takip eder
 * (issue #521 + operation-aware #566).
 *
 * Tek bir bozuk operasyon (orn. FETCH_INVOICES) artik tum entegrasyonu pasife cekmez:
 *  - Her operasyon turunun kendi sayaci vardir; esik asilinca o operasyon "fail eden operasyonlar"
 *    SET'ine eklenir ve ilgili operasyonun devresi (CircuitBreaker) acilir.
 *  - Entegrasyon SADECE birden fazla farkli operasyon turu (>= deactivationOperationThreshold)
 *    kendi esigini astiginda — yani gercek bir credential-geneli sorun varsa — pasife cekilir.
 *  - Basarili bir cagri yalnizca KENDI operasyonunun sayacini sifirlar.
 *
 * Redis key'leri (TTL 24 saat):
 *  - Operasyon sayaci: integration:auth-failures:{userId}:{integrationId}:{operationType}
 *  - Fail eden operasyonlar SET'i: integration:auth-failed-ops:{userId}:{integrationId}
 */
export class AuthFailureTracker {
    private static readonly DEFAULT_THRESHOLD = 5;
    private static readonly DEFAULT_DEACTIVATION_OP_THRESHOLD = 2;
    private static readonly TTL_SECONDS = 86400; // 24 saat
    private static connection?: mongoose.Connection;

    /**
     * Servis startup'inda cagrilir — Outbox event publish'i icin mongoose connection'i inject eder.
     * moon-lib pattern (retryableListener, eventPublisherJob) ile tutarli: explicit connection injection.
     */
    static initialize(connection: mongoose.Connection): void {
        AuthFailureTracker.connection = connection;
    }

    /**
     * Operasyon bazli sayac key'i. operationType verilmezse OTHER bucket'ina dusler (geriye uyumlu).
     */
    static getKey(userId: string, integrationId: string, operationType?: OperationType | string): string {
        const op = operationType || OperationType.OTHER;
        return `integration:auth-failures:${userId}:${integrationId}:${op}`;
    }

    /**
     * Esigini asan farkli operasyon turlerini tutan SET key'i (akilli pasiflestirme karari icin).
     */
    static getFailedOpsKey(userId: string, integrationId: string): string {
        return `integration:auth-failed-ops:${userId}:${integrationId}`;
    }

    /**
     * 401/403 aldiginda ILGILI OPERASYONUN counter'ini artir.
     * Operasyon kendi esigini asarsa fail-eden-operasyonlar SET'ine eklenir; SET boyutu
     * deactivationOperationThreshold'a ulasirsa (gercek credential sorunu) event publish edilir.
     * @returns Guncel operasyon counter degeri (Redis hatasi durumunda 0)
     */
    static async increment(
        context: AuthFailureTrackerContext,
        lastErrorStatus: 401 | 403,
        lastErrorMessage?: string,
        operationType?: OperationType | string
    ): Promise<number> {
        const op = operationType || OperationType.OTHER;
        const key = AuthFailureTracker.getKey(context.userId, context.integrationId, op);
        let count = 0;

        try {
            count = await redisWrapper.client.incr(key);
        } catch (redisError) {
            logger.warn('AuthFailureTracker: Redis increment failed, skipping tracking', {
                error: (redisError as Error).message,
                userId: context.userId,
                integrationId: context.integrationId,
                operationType: op
            });
            return 0;
        }

        // TTL'i HER increment'te yenile: INCR ile EXPIRE arasinda servis crash olursa
        // key'in TTL'siz (kalici) kalmasini onler (#566 guvenlik incelemesi).
        // Ayri try: EXPIRE basarisiz olsa bile gecerli `count` korunur — esik/pasiflestirme
        // degerlendirmesi atlanmaz (best-effort TTL tazeleme).
        try {
            await redisWrapper.client.expire(key, AuthFailureTracker.TTL_SECONDS);
        } catch (expireError) {
            logger.warn('AuthFailureTracker: Redis expire (TTL refresh) failed — counter still valid', {
                error: (expireError as Error).message,
                userId: context.userId,
                integrationId: context.integrationId,
                operationType: op
            });
        }

        const threshold = context.threshold ?? AuthFailureTracker.DEFAULT_THRESHOLD;
        logger.warn(`AuthFailureTracker: auth failure recorded for ${context.integrationName} [${op}]`, {
            userId: context.userId,
            integrationId: context.integrationId,
            operationType: op,
            count,
            threshold,
            status: lastErrorStatus
        });

        if (count >= threshold) {
            await AuthFailureTracker.evaluateDeactivation(context, op, count, lastErrorStatus, lastErrorMessage);
        }

        return count;
    }

    /**
     * Bir operasyon kendi esigini astiginda cagrilir.
     * Operasyonu fail-eden-operasyonlar SET'ine ekler ve SET boyutuna gore
     * entegrasyonu pasife cekip cekmeyecegine karar verir.
     */
    private static async evaluateDeactivation(
        context: AuthFailureTrackerContext,
        operationType: OperationType | string,
        failureCount: number,
        lastErrorStatus: 401 | 403,
        lastErrorMessage?: string
    ): Promise<void> {
        const failedOpsKey = AuthFailureTracker.getFailedOpsKey(context.userId, context.integrationId);
        const deactivationThreshold =
            context.deactivationOperationThreshold ?? AuthFailureTracker.DEFAULT_DEACTIVATION_OP_THRESHOLD;

        let distinctFailedOps = 0;
        let failedOperations: string[] = [];
        try {
            await redisWrapper.client.sAdd(failedOpsKey, String(operationType));
            // SET TTL'ini her tetiklemede yenile (sAdd/EXPIRE atomik degil — kalici key riskini onler).
            await redisWrapper.client.expire(failedOpsKey, AuthFailureTracker.TTL_SECONDS);
            failedOperations = await redisWrapper.client.sMembers(failedOpsKey);
            distinctFailedOps = failedOperations.length;
        } catch (redisError) {
            // SET okunamazsa pasiflestirme karari guvenli tarafta kalir: entegrasyon AÇIK tutulur.
            logger.warn('AuthFailureTracker: failed-ops SET update failed — keeping integration active', {
                error: (redisError as Error).message,
                userId: context.userId,
                integrationId: context.integrationId,
                operationType
            });
            return;
        }

        if (distinctFailedOps >= deactivationThreshold) {
            // Gercek credential-geneli sorun: entegrasyonu pasife cek.
            await AuthFailureTracker.publishExceededEvent(
                context,
                failureCount,
                lastErrorStatus,
                lastErrorMessage,
                failedOperations
            );
        } else {
            // Tek operasyon bozuk: entegrasyon AÇIK kalir, yalnizca o operasyonun devresi acilir.
            logger.warn(
                `AuthFailureTracker: operation [${operationType}] threshold exceeded but integration kept ACTIVE ` +
                    `(${distinctFailedOps}/${deactivationThreshold} distinct failing operations)`,
                {
                    userId: context.userId,
                    integrationId: context.integrationId,
                    integrationName: context.integrationName,
                    operationType,
                    failedOperations,
                    distinctFailedOps,
                    deactivationThreshold
                }
            );
        }
    }

    /**
     * Basarili bir API call sonrasi counter'i sifirla.
     *  - operationType verilirse: YALNIZCA o operasyonun sayacini sifirlar ve SET'ten cikarir.
     *  - operationType verilmezse: TUM operasyon sayaclarini + fail-eden-operasyonlar SET'ini temizler
     *    (entegrasyon pasiflestirme/reaktivasyon sirasinda temiz baslangic icin).
     */
    static async reset(
        userId: string,
        integrationId: string,
        operationType?: OperationType | string
    ): Promise<void> {
        const failedOpsKey = AuthFailureTracker.getFailedOpsKey(userId, integrationId);
        try {
            if (operationType) {
                const key = AuthFailureTracker.getKey(userId, integrationId, operationType);
                const deleted = await redisWrapper.client.del(key);
                await redisWrapper.client.sRem(failedOpsKey, String(operationType));
                if (deleted === 1) {
                    logger.info('AuthFailureTracker: operation counter reset', { userId, integrationId, operationType });
                }
                return;
            }

            // Tam reset: SET uyelerinin tum sayaclarini ve SET'in kendisini temizle.
            let members: string[] = [];
            try {
                members = await redisWrapper.client.sMembers(failedOpsKey);
            } catch {
                members = [];
            }
            const keysToDelete = members.map((op) => AuthFailureTracker.getKey(userId, integrationId, op));
            // Legacy (operasyon-oncesi #521) key'i de temizle — deploy gecisi guvenligi
            keysToDelete.push(`integration:auth-failures:${userId}:${integrationId}`);
            keysToDelete.push(failedOpsKey);
            const deleted = await redisWrapper.client.del(keysToDelete);
            if (deleted > 0) {
                logger.info('AuthFailureTracker: full counter reset', { userId, integrationId, clearedKeys: deleted });
            }
        } catch (redisError) {
            logger.warn('AuthFailureTracker: Redis reset failed', {
                error: (redisError as Error).message,
                userId,
                integrationId,
                operationType
            });
        }
    }

    /**
     * Mevcut counter degerini oku (debug/UI icin).
     *  - operationType verilirse: o operasyonun sayaci.
     *  - verilmezse: fail-eden tum operasyonlarin sayaclari toplami (best-effort aggregate).
     */
    static async get(
        userId: string,
        integrationId: string,
        operationType?: OperationType | string
    ): Promise<number> {
        try {
            if (operationType) {
                const key = AuthFailureTracker.getKey(userId, integrationId, operationType);
                const value = await redisWrapper.client.get(key);
                return value ? parseInt(value, 10) : 0;
            }

            const failedOpsKey = AuthFailureTracker.getFailedOpsKey(userId, integrationId);
            const members = await redisWrapper.client.sMembers(failedOpsKey);
            let total = 0;
            for (const op of members) {
                const value = await redisWrapper.client.get(
                    AuthFailureTracker.getKey(userId, integrationId, op)
                );
                total += value ? parseInt(value, 10) : 0;
            }
            return total;
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
        lastErrorMessage: string | undefined,
        failedOperations: string[]
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
                    failedOperations,
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
                lastErrorStatus,
                failedOperations
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
