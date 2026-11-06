import { AuthFailureTracker } from '../utils/authFailureTracker.util';
import { OperationType } from '../enums/operation-type.enum';

// In-memory Redis store — gercek incr/SET semantigi ile (operation-aware testler icin)
const store: Record<string, any> = {};

jest.mock('../services/redisWrapper.service', () => {
    const client = {
        incr: jest.fn((key: string) => {
            const next = (parseInt(store[key] || '0', 10) || 0) + 1;
            store[key] = String(next);
            return Promise.resolve(next);
        }),
        expire: jest.fn(() => Promise.resolve(1)),
        del: jest.fn((key: string | string[]) => {
            const keys = Array.isArray(key) ? key : [key];
            let removed = 0;
            for (const k of keys) {
                if (store[k] !== undefined) {
                    delete store[k];
                    removed++;
                }
            }
            return Promise.resolve(removed);
        }),
        get: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
        sAdd: jest.fn((key: string, member: string) => {
            if (!(store[key] instanceof Set)) store[key] = new Set<string>();
            const had = store[key].has(member);
            store[key].add(member);
            return Promise.resolve(had ? 0 : 1);
        }),
        sMembers: jest.fn((key: string) =>
            Promise.resolve(store[key] instanceof Set ? Array.from(store[key] as Set<string>) : [])),
        sRem: jest.fn((key: string, member: string) => {
            if (!(store[key] instanceof Set)) return Promise.resolve(0);
            return Promise.resolve(store[key].delete(member) ? 1 : 0);
        }),
        sCard: jest.fn((key: string) =>
            Promise.resolve(store[key] instanceof Set ? store[key].size : 0)),
    };
    return { redisWrapper: { client } };
});

jest.mock('../models/outbox.schema', () => ({
    createOutboxModel: () => ({
        build: (attrs: any) => ({ ...attrs, save: jest.fn().mockResolvedValue(true) })
    })
}));

jest.mock('../utils/optimisticLocking.util', () => ({
    OptimisticLockingUtil: {
        saveWithRetry: jest.fn().mockResolvedValue(true)
    }
}));

import { redisWrapper } from '../services/redisWrapper.service';
import { OptimisticLockingUtil } from '../utils/optimisticLocking.util';

const mockClient = redisWrapper.client as jest.Mocked<any>;

describe('AuthFailureTracker (operation-aware #566)', () => {
    const userId = 'user-123';
    const integrationId = 'int-456';
    const baseContext = {
        userId,
        integrationId,
        integrationName: 'trendyol',
        threshold: 5,
        deactivationOperationThreshold: 2
    };

    beforeAll(() => {
        AuthFailureTracker.initialize({} as any);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        for (const k of Object.keys(store)) delete store[k];
    });

    describe('getKey', () => {
        it('builds an operation-scoped key', () => {
            expect(AuthFailureTracker.getKey(userId, integrationId, OperationType.FETCH_ORDERS)).toBe(
                `integration:auth-failures:${userId}:${integrationId}:FETCH_ORDERS`
            );
        });

        it('falls back to OTHER bucket when operationType missing (backward compat)', () => {
            expect(AuthFailureTracker.getKey(userId, integrationId)).toBe(
                `integration:auth-failures:${userId}:${integrationId}:OTHER`
            );
        });
    });

    describe('getFailedOpsKey', () => {
        it('builds the distinct-failed-ops SET key', () => {
            expect(AuthFailureTracker.getFailedOpsKey(userId, integrationId)).toBe(
                `integration:auth-failed-ops:${userId}:${integrationId}`
            );
        });
    });

    describe('increment', () => {
        it('increments per-operation counter and sets 24h TTL on first increment', async () => {
            const count = await AuthFailureTracker.increment(baseContext, 401, undefined, OperationType.FETCH_ORDERS);

            expect(count).toBe(1);
            expect(mockClient.incr).toHaveBeenCalledWith(
                AuthFailureTracker.getKey(userId, integrationId, OperationType.FETCH_ORDERS)
            );
            expect(mockClient.expire).toHaveBeenCalledWith(
                AuthFailureTracker.getKey(userId, integrationId, OperationType.FETCH_ORDERS),
                86400
            );
            expect(OptimisticLockingUtil.saveWithRetry).not.toHaveBeenCalled();
        });

        it('keeps separate counters per operation type', async () => {
            await AuthFailureTracker.increment(baseContext, 401, undefined, OperationType.FETCH_ORDERS);
            await AuthFailureTracker.increment(baseContext, 401, undefined, OperationType.FETCH_ORDERS);
            const stockCount = await AuthFailureTracker.increment(baseContext, 401, undefined, OperationType.UPDATE_STOCK);

            expect(stockCount).toBe(1); // UPDATE_STOCK sayaci FETCH_ORDERS'tan bagimsiz
            expect(await AuthFailureTracker.get(userId, integrationId, OperationType.FETCH_ORDERS)).toBe(2);
        });

        it('does NOT deactivate when a SINGLE operation exceeds threshold (kept active)', async () => {
            // FETCH_INVOICES 5 kez 403 — tek bozuk endpoint
            for (let i = 0; i < 5; i++) {
                await AuthFailureTracker.increment(baseContext, 403, 'forbidden', OperationType.FETCH_INVOICES);
            }

            // Tek operasyon SET'e eklendi ama distinct=1 < 2 → publish YOK (entegrasyon acik)
            expect(mockClient.sAdd).toHaveBeenCalledWith(
                AuthFailureTracker.getFailedOpsKey(userId, integrationId),
                'FETCH_INVOICES'
            );
            expect(OptimisticLockingUtil.saveWithRetry).not.toHaveBeenCalled();
        });

        it('deactivates when TWO distinct operations each exceed threshold (real credential issue)', async () => {
            for (let i = 0; i < 5; i++) {
                await AuthFailureTracker.increment(baseContext, 401, 'unauthorized', OperationType.FETCH_ORDERS);
            }
            // Henuz tek operasyon → publish yok
            expect(OptimisticLockingUtil.saveWithRetry).not.toHaveBeenCalled();

            for (let i = 0; i < 5; i++) {
                await AuthFailureTracker.increment(baseContext, 401, 'unauthorized', OperationType.UPDATE_STOCK);
            }
            // Ikinci farkli operasyon esigi asti → distinct=2 >= 2 → publish
            expect(OptimisticLockingUtil.saveWithRetry).toHaveBeenCalled();
        });

        it('includes failedOperations array in the published event payload', async () => {
            for (let i = 0; i < 5; i++) {
                await AuthFailureTracker.increment(baseContext, 401, 'unauthorized', OperationType.FETCH_ORDERS);
            }
            for (let i = 0; i < 5; i++) {
                await AuthFailureTracker.increment(baseContext, 401, 'unauthorized', OperationType.UPDATE_STOCK);
            }

            const builtEvent = (OptimisticLockingUtil.saveWithRetry as jest.Mock).mock.calls[0][0];
            expect(builtEvent.payload.failedOperations).toEqual(
                expect.arrayContaining(['FETCH_ORDERS', 'UPDATE_STOCK'])
            );
            expect(builtEvent.eventType).toBeDefined();
        });

        it('falls back to OTHER bucket when operationType not provided (backward compat)', async () => {
            const count = await AuthFailureTracker.increment(baseContext, 401);

            expect(count).toBe(1);
            expect(mockClient.incr).toHaveBeenCalledWith(
                AuthFailureTracker.getKey(userId, integrationId, OperationType.OTHER)
            );
        });

        it('respects a deactivationOperationThreshold of 1 (aggressive)', async () => {
            const ctx = { ...baseContext, deactivationOperationThreshold: 1 };
            for (let i = 0; i < 5; i++) {
                await AuthFailureTracker.increment(ctx, 401, 'unauthorized', OperationType.FETCH_ORDERS);
            }
            // Tek operasyon yeterli → publish
            expect(OptimisticLockingUtil.saveWithRetry).toHaveBeenCalled();
        });

        it('returns 0 and skips tracking on Redis error (graceful degradation)', async () => {
            mockClient.incr.mockRejectedValueOnce(new Error('Redis connection lost'));

            const count = await AuthFailureTracker.increment(baseContext, 401, undefined, OperationType.FETCH_ORDERS);

            expect(count).toBe(0);
            expect(OptimisticLockingUtil.saveWithRetry).not.toHaveBeenCalled();
        });

        it('preserves a valid count and still evaluates when only TTL refresh (expire) fails', async () => {
            const ctx = { ...baseContext, deactivationOperationThreshold: 1 };
            store[AuthFailureTracker.getKey(userId, integrationId, OperationType.FETCH_ORDERS)] = '4';
            mockClient.expire.mockRejectedValueOnce(new Error('Redis EXPIRE failed'));

            // incr -> 5 (gecerli), expire patlar; count atilmamali, eval devam etmeli
            const count = await AuthFailureTracker.increment(ctx, 401, 'unauthorized', OperationType.FETCH_ORDERS);

            expect(count).toBe(5);
            expect(mockClient.sAdd).toHaveBeenCalled(); // evaluateDeactivation calisti
            expect(OptimisticLockingUtil.saveWithRetry).toHaveBeenCalled(); // threshold=1 -> publish
        });

        it('UC-1268: definite signal deactivates after a SINGLE operation exceeds threshold (publishes event with the non-401/403 status)', async () => {
            for (let i = 0; i < 5; i++) {
                await AuthFailureTracker.increment(baseContext, 400, 'authenticationFailed', OperationType.FETCH_ORDERS, {
                    definite: true
                });
            }

            expect(OptimisticLockingUtil.saveWithRetry).toHaveBeenCalledTimes(1);
            const published = (OptimisticLockingUtil.saveWithRetry as jest.Mock).mock.calls[0][0];
            expect(published.payload).toEqual(
                expect.objectContaining({ lastErrorStatus: 400, failureCount: 5, failedOperations: [OperationType.FETCH_ORDERS] })
            );
        });

        it('UC-1268: without definite signal a single operation still does NOT deactivate (#566 preserved, also for 401/403)', async () => {
            for (let i = 0; i < 5; i++) {
                await AuthFailureTracker.increment(baseContext, 401, 'unauthorized', OperationType.FETCH_ORDERS, {
                    definite: false
                });
            }

            expect(OptimisticLockingUtil.saveWithRetry).not.toHaveBeenCalled();
        });

        it('UC-1302: clears its OWN counters + failed-ops SET right after queueing the exceeded event (same Redis DB as increment)', async () => {
            // Sayaclari yazan surec (entegrasyon servisi) kendi Redis DB'sinde calisir; integration servisinin
            // dinleyicisindeki reset() BASKA bir DB'ye gider ve bu anahtarlara ulasamaz (canli: n11 /15, integration /0).
            for (let i = 0; i < 5; i++) {
                await AuthFailureTracker.increment(baseContext, 400, 'authenticationFailed', OperationType.FETCH_ORDERS, {
                    definite: true
                });
            }
            expect(OptimisticLockingUtil.saveWithRetry).toHaveBeenCalledTimes(1);

            expect(store[AuthFailureTracker.getKey(userId, integrationId, OperationType.FETCH_ORDERS)]).toBeUndefined();
            expect(store[AuthFailureTracker.getFailedOpsKey(userId, integrationId)]).toBeUndefined();

            // Kimlik degismeden yeniden aktif edilen entegrasyonun ilk hatasi ANINDA tekrar pasife cekmemeli
            const count = await AuthFailureTracker.increment(baseContext, 400, 'authenticationFailed', OperationType.FETCH_ORDERS, {
                definite: true
            });
            expect(count).toBe(1);
            expect(OptimisticLockingUtil.saveWithRetry).toHaveBeenCalledTimes(1);
        });

        it('UC-1302: keeps counters when queueing the exceeded event FAILS (next failure retries the publish)', async () => {
            (OptimisticLockingUtil.saveWithRetry as jest.Mock).mockRejectedValueOnce(new Error('mongo down'));
            for (let i = 0; i < 5; i++) {
                await AuthFailureTracker.increment(baseContext, 400, 'authenticationFailed', OperationType.FETCH_ORDERS, {
                    definite: true
                });
            }

            expect(store[AuthFailureTracker.getKey(userId, integrationId, OperationType.FETCH_ORDERS)]).toBe('5');
            const count = await AuthFailureTracker.increment(baseContext, 400, 'authenticationFailed', OperationType.FETCH_ORDERS, {
                definite: true
            });
            expect(count).toBe(6);
            expect(OptimisticLockingUtil.saveWithRetry).toHaveBeenCalledTimes(2);
        });

        it('keeps integration active when failed-ops SET read fails (safe default)', async () => {
            // Counter esigi asacak ama SET guncellemesi patlayacak → publish YOK
            store[AuthFailureTracker.getKey(userId, integrationId, OperationType.FETCH_ORDERS)] = '4';
            mockClient.sAdd.mockRejectedValueOnce(new Error('Redis down'));

            await AuthFailureTracker.increment(baseContext, 401, 'unauthorized', OperationType.FETCH_ORDERS);

            expect(OptimisticLockingUtil.saveWithRetry).not.toHaveBeenCalled();
        });
    });

    describe('reset', () => {
        it('resets ONLY the given operation counter and removes it from the SET', async () => {
            store[AuthFailureTracker.getKey(userId, integrationId, OperationType.FETCH_ORDERS)] = '3';
            store[AuthFailureTracker.getFailedOpsKey(userId, integrationId)] = new Set(['FETCH_ORDERS', 'UPDATE_STOCK']);

            await AuthFailureTracker.reset(userId, integrationId, OperationType.FETCH_ORDERS);

            expect(mockClient.del).toHaveBeenCalledWith(
                AuthFailureTracker.getKey(userId, integrationId, OperationType.FETCH_ORDERS)
            );
            expect(mockClient.sRem).toHaveBeenCalledWith(
                AuthFailureTracker.getFailedOpsKey(userId, integrationId),
                'FETCH_ORDERS'
            );
            // UPDATE_STOCK SET'te kalmali
            expect(Array.from(store[AuthFailureTracker.getFailedOpsKey(userId, integrationId)])).toEqual(['UPDATE_STOCK']);
        });

        it('full reset (no operationType) clears all operation counters + SET + legacy key', async () => {
            store[AuthFailureTracker.getKey(userId, integrationId, OperationType.FETCH_ORDERS)] = '5';
            store[AuthFailureTracker.getKey(userId, integrationId, OperationType.UPDATE_STOCK)] = '5';
            store[`integration:auth-failures:${userId}:${integrationId}`] = '5'; // legacy
            store[AuthFailureTracker.getFailedOpsKey(userId, integrationId)] = new Set(['FETCH_ORDERS', 'UPDATE_STOCK']);

            await AuthFailureTracker.reset(userId, integrationId);

            expect(store[AuthFailureTracker.getKey(userId, integrationId, OperationType.FETCH_ORDERS)]).toBeUndefined();
            expect(store[AuthFailureTracker.getKey(userId, integrationId, OperationType.UPDATE_STOCK)]).toBeUndefined();
            expect(store[`integration:auth-failures:${userId}:${integrationId}`]).toBeUndefined();
            expect(store[AuthFailureTracker.getFailedOpsKey(userId, integrationId)]).toBeUndefined();
        });

        it('UC-1310: full reset clears BELOW-threshold counters that are NOT in the failed-ops SET', async () => {
            // Gercek akis: 3 hata (esik 5) -> SET bos. Eski reset yalniz SET uyelerini siliyordu.
            for (let i = 0; i < 3; i++) {
                await AuthFailureTracker.increment(baseContext, 401, 'unauthorized', OperationType.FETCH_ORDERS);
            }
            await AuthFailureTracker.increment(baseContext, 401, 'unauthorized', OperationType.OTHER);
            expect(store[AuthFailureTracker.getFailedOpsKey(userId, integrationId)]).toBeUndefined();

            await AuthFailureTracker.reset(userId, integrationId);

            expect(store[AuthFailureTracker.getKey(userId, integrationId, OperationType.FETCH_ORDERS)]).toBeUndefined();
            expect(store[AuthFailureTracker.getKey(userId, integrationId, OperationType.OTHER)]).toBeUndefined();
            // Baska entegrasyonun sayacina dokunmaz
            store[AuthFailureTracker.getKey(userId, 'int-other', OperationType.FETCH_ORDERS)] = '2';
            await AuthFailureTracker.reset(userId, integrationId);
            expect(store[AuthFailureTracker.getKey(userId, 'int-other', OperationType.FETCH_ORDERS)]).toBe('2');
        });

        it('swallows Redis errors without throwing', async () => {
            mockClient.sMembers.mockRejectedValueOnce(new Error('Redis disconnected'));
            mockClient.del.mockRejectedValueOnce(new Error('Redis disconnected'));

            await expect(AuthFailureTracker.reset(userId, integrationId)).resolves.toBeUndefined();
        });
    });

    describe('resetOnReactivation (UC-1310)', () => {
        const seedBelowThreshold = async () => {
            // Esigin altinda sayac (3) + fail-eden SET — kapatip acma senaryosunun baslangici
            for (let i = 0; i < 3; i++) {
                await AuthFailureTracker.increment(baseContext, 401, 'unauthorized', OperationType.FETCH_ORDERS);
            }
            store[AuthFailureTracker.getFailedOpsKey(userId, integrationId)] = new Set([OperationType.UPDATE_STOCK]);
            store[AuthFailureTracker.getKey(userId, integrationId, OperationType.UPDATE_STOCK)] = '5';
        };

        it('reactivated + active ogenin TUM sayaclarini sifirlar (kendi DB)', async () => {
            await seedBelowThreshold();
            const n = await AuthFailureTracker.resetOnReactivation([
                { user: userId, integration: integrationId, active: true, reactivated: true }
            ]);
            expect(n).toBe(1);
            expect(await AuthFailureTracker.get(userId, integrationId, OperationType.FETCH_ORDERS)).toBe(0);
            expect(await AuthFailureTracker.get(userId, integrationId, OperationType.UPDATE_STOCK)).toBe(0);
            expect(store[AuthFailureTracker.getFailedOpsKey(userId, integrationId)]).toBeUndefined();
        });

        it('sifirlamadan sonra esik yeniden tam 5 hata ister (2 hata pasife cekmez)', async () => {
            await seedBelowThreshold();
            await AuthFailureTracker.resetOnReactivation([
                { user: userId, integration: integrationId, active: true, reactivated: true }
            ]);
            await AuthFailureTracker.increment(baseContext, 401, 'unauthorized', OperationType.FETCH_ORDERS);
            const count = await AuthFailureTracker.increment(baseContext, 401, 'unauthorized', OperationType.FETCH_ORDERS);
            expect(count).toBe(2);
            expect(OptimisticLockingUtil.saveWithRetry).not.toHaveBeenCalled();
        });

        it.each([
            ['reactivated yok (eski yayinci / token yenileme)', { active: true }],
            ['reactivated false', { active: true, reactivated: false }],
            ['active false (pasiflestirme yayini)', { active: false, reactivated: true }],
        ])('%s -> sayaclara DOKUNMAZ', async (_label, extra) => {
            await seedBelowThreshold();
            const n = await AuthFailureTracker.resetOnReactivation([
                { user: userId, integration: integrationId, ...(extra as any) }
            ]);
            expect(n).toBe(0);
            expect(mockClient.del).not.toHaveBeenCalled();
            expect(await AuthFailureTracker.get(userId, integrationId, OperationType.FETCH_ORDERS)).toBe(3);
        });

        it('BASE kayit (integration null) atlanir; karisik listede yalniz isaretli oge sifirlanir', async () => {
            await seedBelowThreshold();
            const otherKey = AuthFailureTracker.getKey(userId, 'int-other', OperationType.FETCH_ORDERS);
            store[otherKey] = '4';
            const n = await AuthFailureTracker.resetOnReactivation([
                { user: userId, integration: null, active: true, reactivated: true },
                { user: userId, integration: 'int-other', active: true },
                { user: userId, integration: integrationId, active: true, reactivated: true },
            ]);
            expect(n).toBe(1);
            expect(store[otherKey]).toBe('4');
            expect(await AuthFailureTracker.get(userId, integrationId, OperationType.FETCH_ORDERS)).toBe(0);
        });

        it('bos/undefined liste hata firlatmaz', async () => {
            expect(await AuthFailureTracker.resetOnReactivation([])).toBe(0);
            expect(await AuthFailureTracker.resetOnReactivation(undefined as any)).toBe(0);
        });

        it('Redis hatasi firlatilmaz (dinleyiciyi kirmaz)', async () => {
            mockClient.sMembers.mockRejectedValueOnce(new Error('down'));
            mockClient.del.mockRejectedValueOnce(new Error('down'));
            await expect(AuthFailureTracker.resetOnReactivation([
                { user: userId, integration: integrationId, active: true, reactivated: true }
            ])).resolves.toBe(1);
        });
    });

    describe('get', () => {
        it('returns the counter for a specific operation', async () => {
            store[AuthFailureTracker.getKey(userId, integrationId, OperationType.FETCH_ORDERS)] = '3';

            expect(await AuthFailureTracker.get(userId, integrationId, OperationType.FETCH_ORDERS)).toBe(3);
        });

        it('returns 0 when the operation key does not exist', async () => {
            expect(await AuthFailureTracker.get(userId, integrationId, OperationType.FETCH_ORDERS)).toBe(0);
        });

        it('aggregates counters across all failed operations when no operationType given', async () => {
            store[AuthFailureTracker.getKey(userId, integrationId, OperationType.FETCH_ORDERS)] = '5';
            store[AuthFailureTracker.getKey(userId, integrationId, OperationType.UPDATE_STOCK)] = '2';
            store[AuthFailureTracker.getFailedOpsKey(userId, integrationId)] = new Set(['FETCH_ORDERS', 'UPDATE_STOCK']);

            expect(await AuthFailureTracker.get(userId, integrationId)).toBe(7);
        });

        it('returns 0 on Redis error', async () => {
            mockClient.get.mockRejectedValueOnce(new Error('network'));

            expect(await AuthFailureTracker.get(userId, integrationId, OperationType.FETCH_ORDERS)).toBe(0);
        });
    });
});
