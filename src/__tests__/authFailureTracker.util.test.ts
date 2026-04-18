import { AuthFailureTracker } from '../utils/authFailureTracker.util';

// redisWrapper mock
jest.mock('../services/redisWrapper.service', () => {
    const client = {
        incr: jest.fn(),
        expire: jest.fn(),
        del: jest.fn(),
        get: jest.fn(),
    };
    return { redisWrapper: { client } };
});

// Outbox model mock (publishExceededEvent icin)
jest.mock('../models/outbox.schema', () => ({
    createOutboxModel: () => ({
        build: (attrs: any) => ({ ...attrs, save: jest.fn().mockResolvedValue(true) })
    })
}));

// OptimisticLockingUtil mock
jest.mock('../utils/optimisticLocking.util', () => ({
    OptimisticLockingUtil: {
        saveWithRetry: jest.fn().mockResolvedValue(true)
    }
}));

import { redisWrapper } from '../services/redisWrapper.service';
import { OptimisticLockingUtil } from '../utils/optimisticLocking.util';

const mockClient = redisWrapper.client as jest.Mocked<any>;

describe('AuthFailureTracker', () => {
    const userId = 'user-123';
    const integrationId = 'int-456';
    const context = {
        userId,
        integrationId,
        integrationName: 'trendyol',
        threshold: 5
    };

    beforeAll(() => {
        // Mongoose connection inject (publishExceededEvent icin gerekli)
        AuthFailureTracker.initialize({} as any);
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('initialize', () => {
        it('stores mongoose connection for subsequent Outbox writes', () => {
            const mockConn = { model: jest.fn() } as any;
            AuthFailureTracker.initialize(mockConn);
            // Private alan — exposure'i increment flow'uyla dogrulanir (threshold testleri)
            expect(() => AuthFailureTracker.initialize(mockConn)).not.toThrow();
        });
    });

    describe('getKey', () => {
        it('builds the Redis key from userId and integrationId', () => {
            expect(AuthFailureTracker.getKey(userId, integrationId)).toBe(
                `integration:auth-failures:${userId}:${integrationId}`
            );
        });
    });

    describe('increment', () => {
        it('increments counter and sets 24h TTL on first increment', async () => {
            mockClient.incr.mockResolvedValue(1);
            mockClient.expire.mockResolvedValue(1);

            const count = await AuthFailureTracker.increment(context, 401);

            expect(count).toBe(1);
            expect(mockClient.incr).toHaveBeenCalledWith(AuthFailureTracker.getKey(userId, integrationId));
            expect(mockClient.expire).toHaveBeenCalledWith(
                AuthFailureTracker.getKey(userId, integrationId),
                86400
            );
            // Threshold gecilmedi — outbox'a yazilmamali
            expect(OptimisticLockingUtil.saveWithRetry).not.toHaveBeenCalled();
        });

        it('does NOT set TTL again on subsequent increments', async () => {
            mockClient.incr.mockResolvedValue(3);

            await AuthFailureTracker.increment(context, 401);

            expect(mockClient.incr).toHaveBeenCalled();
            expect(mockClient.expire).not.toHaveBeenCalled();
        });

        it('publishes exceeded event when counter reaches threshold', async () => {
            mockClient.incr.mockResolvedValue(5);

            const count = await AuthFailureTracker.increment(context, 403, 'token expired');

            expect(count).toBe(5);
            expect(OptimisticLockingUtil.saveWithRetry).toHaveBeenCalledTimes(1);
        });

        it('uses default threshold of 5 when not provided', async () => {
            mockClient.incr.mockResolvedValue(5);
            const ctx = { userId, integrationId, integrationName: 'hepsiburada' };

            const count = await AuthFailureTracker.increment(ctx, 401);

            expect(count).toBe(5);
            expect(OptimisticLockingUtil.saveWithRetry).toHaveBeenCalled();
        });

        it('returns 0 and skips publish on Redis error (graceful degradation)', async () => {
            mockClient.incr.mockRejectedValue(new Error('Redis connection lost'));

            const count = await AuthFailureTracker.increment(context, 401);

            expect(count).toBe(0);
            expect(OptimisticLockingUtil.saveWithRetry).not.toHaveBeenCalled();
        });

        it('continues publishing on each subsequent failure after threshold', async () => {
            mockClient.incr.mockResolvedValue(6);
            await AuthFailureTracker.increment(context, 401);

            mockClient.incr.mockResolvedValue(7);
            await AuthFailureTracker.increment(context, 401);

            expect(OptimisticLockingUtil.saveWithRetry).toHaveBeenCalledTimes(2);
        });
    });

    describe('reset', () => {
        it('deletes the Redis counter key', async () => {
            mockClient.del.mockResolvedValue(1);

            await AuthFailureTracker.reset(userId, integrationId);

            expect(mockClient.del).toHaveBeenCalledWith(
                AuthFailureTracker.getKey(userId, integrationId)
            );
        });

        it('swallows Redis errors without throwing', async () => {
            mockClient.del.mockRejectedValue(new Error('Redis disconnected'));

            await expect(
                AuthFailureTracker.reset(userId, integrationId)
            ).resolves.toBeUndefined();
        });
    });

    describe('get', () => {
        it('returns the current counter value', async () => {
            mockClient.get.mockResolvedValue('3');

            const count = await AuthFailureTracker.get(userId, integrationId);

            expect(count).toBe(3);
        });

        it('returns 0 when key does not exist', async () => {
            mockClient.get.mockResolvedValue(null);

            const count = await AuthFailureTracker.get(userId, integrationId);

            expect(count).toBe(0);
        });

        it('returns 0 on Redis error', async () => {
            mockClient.get.mockRejectedValue(new Error('network'));

            const count = await AuthFailureTracker.get(userId, integrationId);

            expect(count).toBe(0);
        });
    });
});
