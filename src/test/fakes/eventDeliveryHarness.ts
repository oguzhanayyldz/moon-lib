/**
 * Shared harness for the #648 event-loss reproduction tests.
 *
 * - Outbox and DeadLetter documents are built with the REAL mongoose models
 *   (schema defaults such as status/environment/retryCount come from production code)
 *   on an offline Mongoose instance, then stored in an InMemoryCollection.
 * - NATS is a fake Stan client whose publish can be switched to fail and whose
 *   subscription lets a test deliver messages exactly like base-listener does.
 * - No network, database or Redis connection is opened.
 */
import mongoose, { Mongoose } from 'mongoose';
import { Message, Stan } from 'node-nats-streaming';
import { createDeadLetterModel, DeadLetterAttrs } from '../../models/deadLetter.schema';
import { createOutboxModel, extractUserIdFromPayload, getEventPriority } from '../../models/outbox.schema';
import { InMemoryCollection } from './inMemoryCollection';

const offlineMongoose = new Mongoose();
offlineMongoose.set('autoIndex', false);
offlineMongoose.set('autoCreate', false);

export const NOT_LOST = 'not lost';

/**
 * A message is silently lost when it was acked although it was neither processed
 * nor recorded in the dead-letter queue: NATS will never redeliver it and nothing
 * is left to replay.
 */
export function deliveryOutcome(outcome: { acked: boolean; processed: boolean; deadLettered: boolean }): string {
    if (!outcome.acked || outcome.processed || outcome.deadLettered) {
        return NOT_LOST;
    }
    return 'LOST: message acked, never processed, no dead-letter record';
}

export function wasAcked(msg: Message): boolean {
    return (msg.ack as jest.Mock).mock.calls.length > 0;
}

export function createFakeMessage(data: object, sequence = 1): Message {
    return {
        ack: jest.fn(),
        getData: jest.fn().mockReturnValue(JSON.stringify(data)),
        getSequence: jest.fn().mockReturnValue(sequence),
        isRedelivered: jest.fn().mockReturnValue(false),
    } as unknown as Message;
}

export function createFakeStan() {
    let publishFails = false;
    const messageHandlers: Array<(msg: Message) => void> = [];

    const publish = jest.fn((_subject: string, _data: string, callback: (err?: Error) => void) => {
        callback(publishFails ? new Error('NATS publish failed: stan connection closed') : undefined);
        return 'guid';
    });

    const subscriptionOptionsChain: Record<string, jest.Mock> = {};
    for (const setter of ['setStartWithLastReceived', 'setDeliverAllAvailable', 'setManualAckMode', 'setAckWait', 'setDurableName']) {
        subscriptionOptionsChain[setter] = jest.fn(() => subscriptionOptionsChain);
    }

    const client = {
        publish,
        subscriptionOptions: jest.fn(() => subscriptionOptionsChain),
        subscribe: jest.fn(() => ({
            on: (event: string, handler: (msg: Message) => void) => {
                if (event === 'message') messageHandlers.push(handler);
            },
        })),
    } as unknown as Stan;

    return {
        client,
        publish,
        setPublishFails(value: boolean) {
            publishFails = value;
        },
        /** Delivers a message the way NATS Streaming does: synchronously to every handler. */
        deliver(msg: Message) {
            messageHandlers.forEach(handler => handler(msg));
        },
    };
}

export function createOutboxStore() {
    const collection = new InMemoryCollection();
    const outboxModel = createOutboxModel(offlineMongoose.connection);
    const connection = { readyState: 1, model: () => collection } as unknown as mongoose.Connection;

    /** Stores a record as a service would after `Outbox.build(...).save()` (pre-save hook fields included). */
    const seed = (eventType: string, payload: Record<string, any>) => {
        const doc = outboxModel.build({ eventType, payload } as any).toObject();
        return collection.insert({
            ...doc,
            priority: getEventPriority(eventType),
            userId: extractUserIdFromPayload(payload),
        });
    };

    return { collection, connection, seed };
}

export function createDeadLetterStore(options: { readyState?: number; saveError?: Error } = {}) {
    const collection = new InMemoryCollection();
    const deadLetterModel = createDeadLetterModel(offlineMongoose.connection);

    const model = {
        build: (attrs: DeadLetterAttrs) => {
            const doc = deadLetterModel.build(attrs);
            return {
                save: async () => {
                    if (options.saveError) throw options.saveError;
                    collection.insert(doc.toObject());
                    return doc;
                },
            };
        },
        findOneAndUpdate: collection.findOneAndUpdate.bind(collection),
        updateOne: collection.updateOne.bind(collection),
        updateMany: collection.updateMany.bind(collection),
    };

    const connection = { readyState: options.readyState ?? 1, model: () => model } as unknown as mongoose.Connection;

    const seed = (attrs: DeadLetterAttrs) => collection.insert(deadLetterModel.build(attrs).toObject());

    return { collection, connection, seed };
}

/**
 * Fakes `Date` and timers (not microtasks/nextTick), so the in-process retry
 * back-off of the publishers (e.g. publishers/stockUpdated.publisher.ts: 5 attempts,
 * 1s..4s apart) and wall-clock based filters run in simulated time.
 */
export function useFakeClock() {
    jest.useFakeTimers({
        doNotFake: [
            'hrtime', 'nextTick', 'performance', 'queueMicrotask',
            'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback',
            'setImmediate', 'clearImmediate',
        ],
    });
    return {
        /** Runs `work` while advancing simulated time by `ms`, flushing promises between timers. */
        async run<T>(work: Promise<T>, ms: number): Promise<T> {
            await jest.advanceTimersByTimeAsync(ms);
            return work;
        },
        advance(ms: number): Promise<void> {
            return jest.advanceTimersByTimeAsync(ms);
        },
    };
}

/** Records the promise of every onMessage call, including the ones base-listener fires without awaiting. */
export function trackInFlightMessages(listener: { onMessage(data: any, msg: Message): Promise<void> }): Promise<void>[] {
    const inFlight: Promise<void>[] = [];
    const original = listener.onMessage.bind(listener);
    jest.spyOn(listener, 'onMessage').mockImplementation((data: any, msg: Message) => {
        const pending = original(data, msg);
        inFlight.push(pending);
        return pending;
    });
    return inFlight;
}
