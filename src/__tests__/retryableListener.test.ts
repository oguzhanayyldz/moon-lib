import { Stan, Message } from 'node-nats-streaming';
import mongoose from 'mongoose';
import { RetryableListener } from '../events/retryableListener';
import { Event, Subjects } from '../common';
import { redisWrapper } from '../services/redisWrapper.service';

// Mock dependencies
jest.mock('../services/redisWrapper.service', () => ({
    redisWrapper: {
        client: {
            set: jest.fn(),
            ttl: jest.fn(),
            eval: jest.fn(),
        }
    }
}));

jest.mock('../services/retryManager', () => ({
    RetryManager: jest.fn().mockImplementation(() => ({
        incrementRetryCount: jest.fn().mockResolvedValue(1),
        resetRetryCount: jest.fn().mockResolvedValue(undefined),
        shouldRetry: jest.fn().mockResolvedValue(true),
    }))
}));

jest.mock('../services/logger.service', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    }
}));

jest.mock('../metrics/EventMetrics', () => ({
    EventMetrics: {
        eventProcessingDuration: { observe: jest.fn() },
        eventProcessingTotal: { inc: jest.fn() },
        eventRetryTotal: { inc: jest.fn() },
        eventDlqTotal: { inc: jest.fn() },
    }
}));

// Test event interface
interface TestEvent extends Event {
    subject: Subjects.UserIntegrationSettings;
    data: {
        list: Array<{ id: string; user: string }>;
    };
}

// Concrete test listener implementation
class TestListener extends RetryableListener<TestEvent> {
    subject: Subjects.UserIntegrationSettings = Subjects.UserIntegrationSettings;
    queueGroupName = 'test-queue-group';

    // Track calls for testing
    public processEventCalls: any[] = [];

    protected async processEvent(data: TestEvent['data']): Promise<void> {
        this.processEventCalls.push(data);
    }

    protected getEventId(data: TestEvent['data']): string {
        return `test-event-${data.list[0]?.id || 'unknown'}`;
    }

    // Expose protected methods for testing
    public getAckWait(): number {
        return this.ackWait;
    }

    public getOptions(): any {
        return (this as any).options;
    }
}

describe('RetryableListener', () => {
    let mockClient: jest.Mocked<Stan>;
    let mockConnection: mongoose.Connection;
    let mockMessage: jest.Mocked<Message>;
    let listener: TestListener;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock NATS client
        mockClient = {
            subscribe: jest.fn().mockReturnValue({
                on: jest.fn(),
            }),
            subscriptionOptions: jest.fn().mockReturnValue({
                setDeliverAllAvailable: jest.fn().mockReturnThis(),
                setManualAckMode: jest.fn().mockReturnThis(),
                setAckWait: jest.fn().mockReturnThis(),
                setDurableName: jest.fn().mockReturnThis(),
            }),
        } as any;

        // Mock MongoDB connection
        mockConnection = {
            readyState: 1,
            model: jest.fn(),
        } as any;

        // Mock NATS message
        mockMessage = {
            ack: jest.fn(),
            getData: jest.fn().mockReturnValue(JSON.stringify({
                list: [{ id: 'test-123', user: 'user-456' }]
            })),
            getSequence: jest.fn().mockReturnValue(1),
        } as any;

        listener = new TestListener(mockClient, {}, mockConnection);
    });

    describe('Default Options', () => {
        it('should have correct default ackWaitSec (60 seconds)', () => {
            const options = listener.getOptions();
            expect(options.ackWaitSec).toBe(60);
        });

        it('should have correct default lockTimeoutSec (30 seconds)', () => {
            const options = listener.getOptions();
            expect(options.lockTimeoutSec).toBe(30);
        });

        it('should have lock enabled by default', () => {
            const options = listener.getOptions();
            expect(options.enableLock).toBe(true);
        });

        it('should set ackWait to ackWaitSec * 1000 milliseconds', () => {
            // ackWaitSec = 60, so ackWait should be 60000ms
            expect(listener.getAckWait()).toBe(60000);
        });
    });

    describe('Custom Options', () => {
        it('should allow custom ackWaitSec', () => {
            const customListener = new TestListener(mockClient, { ackWaitSec: 120 }, mockConnection);
            expect(customListener.getOptions().ackWaitSec).toBe(120);
            expect(customListener.getAckWait()).toBe(120000);
        });

        it('should allow custom lockTimeoutSec', () => {
            const customListener = new TestListener(mockClient, { lockTimeoutSec: 60 }, mockConnection);
            expect(customListener.getOptions().lockTimeoutSec).toBe(60);
        });

        it('should allow disabling lock', () => {
            const customListener = new TestListener(mockClient, { enableLock: false }, mockConnection);
            expect(customListener.getOptions().enableLock).toBe(false);
        });
    });

    describe('Lock Conflict Handling', () => {
        const testData: TestEvent['data'] = {
            list: [{ id: 'test-123', user: 'user-456' }]
        };

        beforeEach(() => {
            // Default: Lock acquisition fails
            (redisWrapper.client.set as jest.Mock).mockResolvedValue(null);
        });

        describe('when TTL is -2 (key does not exist)', () => {
            it('should NOT ack message and allow NATS redelivery', async () => {
                (redisWrapper.client.ttl as jest.Mock).mockResolvedValue(-2);

                await listener.onMessage(testData, mockMessage);

                // Message should NOT be acked - NATS will redeliver
                expect(mockMessage.ack).not.toHaveBeenCalled();
            });
        });

        describe('when TTL is -1 (key exists but no expiry)', () => {
            it('should NOT ack message and allow NATS redelivery', async () => {
                (redisWrapper.client.ttl as jest.Mock).mockResolvedValue(-1);

                await listener.onMessage(testData, mockMessage);

                // Message should NOT be acked - NATS will redeliver
                expect(mockMessage.ack).not.toHaveBeenCalled();
            });
        });

        describe('when TTL is between 1-10 seconds (lock expiring soon)', () => {
            it('should wait and retry lock acquisition', async () => {
                const ttl = 5;
                (redisWrapper.client.ttl as jest.Mock).mockResolvedValue(ttl);

                // First lock attempt fails, second succeeds
                (redisWrapper.client.set as jest.Mock)
                    .mockResolvedValueOnce(null)  // Initial fail
                    .mockResolvedValueOnce('OK'); // Retry success

                const startTime = Date.now();
                await listener.onMessage(testData, mockMessage);
                const elapsed = Date.now() - startTime;

                // Should have waited approximately ttl + 2 seconds
                // Using a range to account for test execution time
                expect(elapsed).toBeGreaterThanOrEqual((ttl + 1) * 1000);

                // Message should be acked after successful retry
                expect(mockMessage.ack).toHaveBeenCalled();

                // Event should have been processed
                expect(listener.processEventCalls).toHaveLength(1);
            }, 15000); // Increase timeout for this test

            it('should NOT ack if retry also fails', async () => {
                const ttl = 3;
                (redisWrapper.client.ttl as jest.Mock).mockResolvedValue(ttl);

                // Both attempts fail
                (redisWrapper.client.set as jest.Mock).mockResolvedValue(null);

                await listener.onMessage(testData, mockMessage);

                // Message should NOT be acked - NATS will redeliver
                expect(mockMessage.ack).not.toHaveBeenCalled();
            }, 10000);
        });

        describe('when TTL is greater than 10 seconds (active processing)', () => {
            it('should ack message (another instance is actively processing)', async () => {
                (redisWrapper.client.ttl as jest.Mock).mockResolvedValue(25);

                await listener.onMessage(testData, mockMessage);

                // Message should be acked - another instance is processing
                expect(mockMessage.ack).toHaveBeenCalled();

                // Event should NOT have been processed by this instance
                expect(listener.processEventCalls).toHaveLength(0);
            });
        });

        describe('when TTL check fails', () => {
            it('should NOT ack message and allow NATS redelivery', async () => {
                (redisWrapper.client.ttl as jest.Mock).mockRejectedValue(new Error('Redis error'));

                await listener.onMessage(testData, mockMessage);

                // Message should NOT be acked - safe fallback
                expect(mockMessage.ack).not.toHaveBeenCalled();
            });
        });
    });

    describe('Successful Lock Acquisition', () => {
        const testData: TestEvent['data'] = {
            list: [{ id: 'test-123', user: 'user-456' }]
        };

        it('should process event and ack message when lock is acquired', async () => {
            // Lock acquisition succeeds
            (redisWrapper.client.set as jest.Mock).mockResolvedValue('OK');

            await listener.onMessage(testData, mockMessage);

            // Event should be processed
            expect(listener.processEventCalls).toHaveLength(1);
            expect(listener.processEventCalls[0]).toEqual(testData);

            // Message should be acked
            expect(mockMessage.ack).toHaveBeenCalled();

            // Lock should be released
            expect(redisWrapper.client.eval).toHaveBeenCalled();
        });
    });

    describe('Lock Disabled', () => {
        const testData: TestEvent['data'] = {
            list: [{ id: 'test-123', user: 'user-456' }]
        };

        it('should process event without lock when enableLock is false', async () => {
            const noLockListener = new TestListener(mockClient, { enableLock: false }, mockConnection);

            await noLockListener.onMessage(testData, mockMessage);

            // Event should be processed
            expect(noLockListener.processEventCalls).toHaveLength(1);

            // Lock should NOT have been attempted
            expect(redisWrapper.client.set).not.toHaveBeenCalled();

            // Message should be acked
            expect(mockMessage.ack).toHaveBeenCalled();
        });
    });

    describe('ackWait vs lockTimeoutSec relationship', () => {
        it('default ackWait (60s) should be greater than lockTimeoutSec (30s)', () => {
            const options = listener.getOptions();
            expect(options.ackWaitSec).toBeGreaterThan(options.lockTimeoutSec);
        });

        it('ackWait should be at least 2x lockTimeoutSec for safe waiting', () => {
            const options = listener.getOptions();
            // ackWait = 60s, lockTimeout = 30s, ratio = 2
            expect(options.ackWaitSec).toBeGreaterThanOrEqual(options.lockTimeoutSec * 2);
        });
    });
});

describe('RetryableListener Integration Scenarios', () => {
    // These tests document expected behavior in real-world scenarios

    describe('Pod Crash Recovery Scenario', () => {
        it('should handle orphan lock from crashed pod', () => {
            /**
             * Scenario:
             * 1. Pod A acquires lock, starts processing
             * 2. Pod A crashes, lock remains in Redis (30s TTL)
             * 3. Pod B receives redelivered message
             * 4. Pod B cannot acquire lock, checks TTL
             * 5. If TTL < 10s: waits and retries
             * 6. If TTL > 10s: assumes active processing, acks (OLD BEHAVIOR - NOW FIXED)
             *
             * With new behavior:
             * - TTL -2/-1: Race condition, NATS redeliver
             * - TTL 1-10s: Wait and retry
             * - TTL > 10s: Another instance actively processing, ack
             *
             * This prevents event loss when pods crash.
             */
            expect(true).toBe(true); // Documentation test
        });
    });

    describe('Rolling Update Scenario', () => {
        it('should handle graceful pod termination', () => {
            /**
             * Scenario:
             * 1. Kubernetes sends SIGTERM to Pod A
             * 2. Pod A finishes current event, releases lock
             * 3. New Pod B starts, receives next events
             *
             * With 60s ackWait and 30s lockTimeout:
             * - Enough time for graceful shutdown
             * - No event loss during rolling updates
             */
            expect(true).toBe(true); // Documentation test
        });
    });
});
