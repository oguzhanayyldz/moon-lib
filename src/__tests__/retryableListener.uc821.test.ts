/**
 * UC-821 Adım 2 + UC-430 — RetryableListener lock/ack contract.
 *
 * - The event lock is renewed by default (lockTimeoutSec/3): processEvent running longer than the lock TTL keeps
 *   the lock, so a NATS redelivery of the same message does not run the command a second time.
 *   Explicit 0 or RETRYABLE_LOCK_RENEW_INTERVAL_MS=0 turns renewal off (old behaviour).
 * - A redelivery without a NATS sequence is never acked while the same payload is locked: it may be the holder's own
 *   message, and acking it loses the event if the holder fails afterwards.
 * - The constructor warns when lockTimeoutSec >= ackWaitSec.
 * RetryableListener runs as production code; Redis is the in-memory fake (SET NX EX, TTL and the renew script are real),
 * NATS and Mongo are fakes. Times are scaled down: lockTimeoutSec 1 s stands for 30 s, the redelivery at 1.2 s for 60 s.
 */
import { Message } from 'node-nats-streaming';
import { RetryableListener, resolveLockRenewIntervalMs } from '../events/retryableListener';
import { Event, Subjects } from '../common';
import { logger } from '../services/logger.service';
import { redisWrapper } from '../services/redisWrapper.service';
import { InMemoryRedis } from '../test/fakes/inMemoryRedis';
import { createDeadLetterStore, createFakeMessage, createFakeStan, wasAcked } from '../test/fakes/eventDeliveryHarness';

jest.mock('../services/redisWrapper.service', () => {
    const { InMemoryRedis: Redis } = jest.requireActual('../test/fakes/inMemoryRedis');
    return { redisWrapper: { client: new Redis() } };
});

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
        eventDuplicateKeyTotal: { inc: jest.fn() },
        eventDlqWriteErrorTotal: { inc: jest.fn() },
        eventDlqReplayTotal: { inc: jest.fn() },
        eventPermanentErrorTotal: { inc: jest.fn() },
    }
}));

interface CreateInvoicesEvent extends Event {
    subject: Subjects.OrderCreated;
    data: { requestId: string; invoices: string[] };
}

const payload: CreateInvoicesEvent['data'] = { requestId: 'req-1', invoices: ['inv-1', 'inv-2'] };

/** Stands for a command listener (e.g. Paraşüt createInvoices): counts how often the integration method ran. */
class CommandListener extends RetryableListener<CreateInvoicesEvent> {
    subject: Subjects.OrderCreated = Subjects.OrderCreated;
    queueGroupName = 'uc821-test';
    integrationCalls = 0;
    work: () => Promise<void> = async () => undefined;

    protected async processEvent(): Promise<void> {
        this.integrationCalls++;
        await this.work();
    }

    protected getEventId(data: CreateInvoicesEvent['data']): string {
        return `command-${data.requestId}`;
    }
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function newListener(options: ConstructorParameters<typeof RetryableListener>[1] = {}) {
    const nats = createFakeStan();
    const deadLetters = createDeadLetterStore();
    return new CommandListener(nats.client, options, deadLetters.connection);
}

/** A delivery without NATS sequence (getSequence unavailable), optionally flagged as redelivered. */
function messageWithoutSequence(redelivered: boolean): Message {
    const msg = createFakeMessage(payload);
    (msg.getSequence as jest.Mock).mockReturnValue(undefined);
    (msg.isRedelivered as jest.Mock).mockReturnValue(redelivered);
    return msg;
}

beforeEach(() => {
    jest.clearAllMocks();
    (redisWrapper.client as unknown as InMemoryRedis).flushAll();
    delete process.env.RETRYABLE_LOCK_RENEW_INTERVAL_MS;
});

afterAll(() => {
    delete process.env.RETRYABLE_LOCK_RENEW_INTERVAL_MS;
});

describe('UC-821 resolveLockRenewIntervalMs', () => {
    it.each([
        [undefined, undefined, 30, 10000],
        [undefined, undefined, 120, 40000],
        [undefined, undefined, 1, 333],
        [0, undefined, 30, 0],
        [5000, undefined, 30, 5000],
        [undefined, '0', 30, 0],
        [undefined, '2000', 30, 2000],
        [7000, '0', 30, 7000],
        [undefined, '', 30, 10000],
        [undefined, 'abc', 30, 10000],
        [undefined, '-5', 30, 10000],
        [-1, undefined, 30, 10000],
        [1.5, undefined, 30, 10000],
    ])('explicit %p, env %p, lockTimeoutSec %p → %p', (explicit, env, lockTimeoutSec, expected) => {
        if (env !== undefined) process.env.RETRYABLE_LOCK_RENEW_INTERVAL_MS = env;
        expect(resolveLockRenewIntervalMs(explicit as number | undefined, lockTimeoutSec)).toBe(expected);
    });
});

describe('UC-430 processEvent longer than the lock TTL, redelivered while running', () => {
    async function runWithRedelivery(options: ConstructorParameters<typeof RetryableListener>[1]) {
        const listener = newListener(options);
        listener.work = () => sleep(1500);
        const first = createFakeMessage(payload, 7);
        const redelivery = createFakeMessage(payload, 7);
        (redelivery.isRedelivered as jest.Mock).mockReturnValue(true);

        const running = listener.onMessage(payload, first);
        await sleep(1200); // ackWait passed: NATS redelivers the same message (same sequence)
        await listener.onMessage(payload, redelivery);
        await running;

        return { integrationCalls: listener.integrationCalls, firstAcked: wasAcked(first), redeliveryAcked: wasAcked(redelivery) };
    }

    it('default options: the command runs once, the redelivery is not acked, the original delivery acks', async () => {
        expect(await runWithRedelivery({ lockTimeoutSec: 1 }))
            .toEqual({ integrationCalls: 1, firstAcked: true, redeliveryAcked: false });
    });

    it('renewal turned off by env (old behaviour): the lock expires and the command runs twice', async () => {
        process.env.RETRYABLE_LOCK_RENEW_INTERVAL_MS = '0';
        expect((await runWithRedelivery({ lockTimeoutSec: 1 })).integrationCalls).toBe(2);
    });
});

describe('UC-821 F-02 redelivery without sequence while the same payload is locked', () => {
    it('is not acked; when the holder then fails, nothing acked the message (NATS redelivers it)', async () => {
        const listener = newListener({ lockTimeoutSec: 10 }); // TTL > 5 s: the active-holder branch, not the short-wait one
        listener.work = async () => {
            await sleep(300);
            throw new Error('ERP timeout');
        };
        const first = messageWithoutSequence(false);
        const redelivery = messageWithoutSequence(true);

        const running = listener.onMessage(payload, first);
        await sleep(100);
        await listener.onMessage(payload, redelivery);
        await running;

        expect({ integrationCalls: listener.integrationCalls, firstAcked: wasAcked(first), redeliveryAcked: wasAcked(redelivery) })
            .toEqual({ integrationCalls: 1, firstAcked: false, redeliveryAcked: false });
    });

    it('a first delivery (not redelivered) of the same payload is still acked as a copy (behaviour unchanged)', async () => {
        const listener = newListener({ lockTimeoutSec: 10 }); // TTL > 5 s: the active-holder branch, not the short-wait one
        listener.work = () => sleep(300);
        const first = messageWithoutSequence(false);
        const copy = messageWithoutSequence(false);

        const running = listener.onMessage(payload, first);
        await sleep(100);
        await listener.onMessage(payload, copy);
        await running;

        expect({ integrationCalls: listener.integrationCalls, firstAcked: wasAcked(first), copyAcked: wasAcked(copy) })
            .toEqual({ integrationCalls: 1, firstAcked: true, copyAcked: true });
    });
});

describe('UC-821 constructor check lockTimeoutSec >= ackWaitSec', () => {
    const lockWarnings = () =>
        (logger.warn as jest.Mock).mock.calls.filter(([m]) => String(m).includes('is not shorter than ackWaitSec')).map(([m]) => String(m));

    it.each([
        [{ lockTimeoutSec: 60, ackWaitSec: 60 }, 1],
        [{ lockTimeoutSec: 120 }, 1],
        [{}, 0],
        [{ lockTimeoutSec: 120, ackWaitSec: 150 }, 0],
        [{ lockTimeoutSec: 120, enableLock: false }, 0],
    ])('%p → %p warning', (options, expected) => {
        newListener(options);
        expect(lockWarnings()).toHaveLength(expected);
    });

    it('names the listener class in the warning', () => {
        newListener({ lockTimeoutSec: 90 });
        expect(lockWarnings()[0]).toContain('CommandListener');
    });
});
