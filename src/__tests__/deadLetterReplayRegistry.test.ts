/**
 * Issue #648 · 648-G3 DLQ-H — unit tests of the in-process dead-letter replay registry.
 */
import {
    buildListenerKey,
    DeadLetterReplayRegistry,
    deadLetterReplayRegistry,
    DeadLetterReplayResult,
    DeadLetterReplayTarget,
} from '../events/deadLetterReplayRegistry';
import { logger } from '../services/logger.service';

jest.mock('../services/logger.service', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    }
}));

function createTarget(subject: string, queueGroupName: string): DeadLetterReplayTarget {
    return {
        subject,
        queueGroupName,
        replayDeadLetter: jest.fn(async (): Promise<DeadLetterReplayResult> => 'processed'),
        getDeadLetterReplayDelay: jest.fn(() => 60_000),
    };
}

describe('#648 DLQ-H — buildListenerKey', () => {
    it('joins subject and queue group name with "|"', () => {
        expect(buildListenerKey('stock:updated', 'orders-service')).toBe('stock:updated|orders-service');
    });

    it('keeps the same subject in different queue groups apart', () => {
        expect(buildListenerKey('stock:updated', 'orders-service')).not.toBe(buildListenerKey('stock:updated', 'integration-service'));
    });
});

describe('#648 DLQ-H — DeadLetterReplayRegistry', () => {
    let registry: DeadLetterReplayRegistry;

    beforeEach(() => {
        jest.clearAllMocks();
        registry = new DeadLetterReplayRegistry();
    });

    it('register: a listener with replay enabled is returned by get() and listed in both key lists', () => {
        const target = createTarget('stock:updated', 'orders-service');

        expect(registry.register(target, true)).toBe(true);

        expect({
            target: registry.get('stock:updated|orders-service'),
            replayable: registry.replayableKeys(),
            registered: registry.registeredKeys(),
        }).toEqual({ target, replayable: ['stock:updated|orders-service'], registered: ['stock:updated|orders-service'] });
    });

    it('register: a listener with replay disabled is registered but get() does not return it and it is not replayable', () => {
        const target = createTarget('stock:updated', 'orders-service');

        expect(registry.register(target, false)).toBe(true);

        expect({
            target: registry.get('stock:updated|orders-service'),
            replayable: registry.replayableKeys(),
            registered: registry.registeredKeys(),
        }).toEqual({ target: undefined, replayable: [], registered: ['stock:updated|orders-service'] });
    });

    it('register: a second listener with the same key is ignored with a warning and the first one stays', () => {
        const first = createTarget('entity:deleted', 'catalog-service');
        const second = createTarget('entity:deleted', 'catalog-service');
        registry.register(first, true);

        expect(registry.register(second, false)).toBe(false);

        expect(registry.get('entity:deleted|catalog-service')).toBe(first);
        expect(registry.registeredKeys()).toEqual(['entity:deleted|catalog-service']);
        expect(logger.warn).toHaveBeenCalledWith('Dead letter replay target already registered, keeping the first listener: entity:deleted|catalog-service');
    });

    it('keys of several listeners keep registration order; only replay-enabled keys are replayable', () => {
        registry.register(createTarget('stock:updated', 'orders-service'), true);
        registry.register(createTarget('stock:updated', 'integration-service'), false);
        registry.register(createTarget('product:price-updated', 'orders-service'), true);

        expect({ replayable: registry.replayableKeys(), registered: registry.registeredKeys() }).toEqual({
            replayable: ['stock:updated|orders-service', 'product:price-updated|orders-service'],
            registered: ['stock:updated|orders-service', 'stock:updated|integration-service', 'product:price-updated|orders-service'],
        });
    });

    it('get: an unknown key returns undefined', () => {
        registry.register(createTarget('stock:updated', 'orders-service'), true);

        expect(registry.get('stock:updated|removed-service')).toBeUndefined();
        expect(registry.get('')).toBeUndefined();
    });

    it('an empty registry has no keys', () => {
        expect({ replayable: registry.replayableKeys(), registered: registry.registeredKeys() }).toEqual({ replayable: [], registered: [] });
    });

    it('clear: removes every registration so the same key can be registered again', () => {
        const first = createTarget('stock:updated', 'orders-service');
        const second = createTarget('stock:updated', 'orders-service');
        registry.register(first, true);

        registry.clear();

        expect({ replayable: registry.replayableKeys(), registered: registry.registeredKeys() }).toEqual({ replayable: [], registered: [] });
        expect(registry.register(second, true)).toBe(true);
        expect(registry.get('stock:updated|orders-service')).toBe(second);
    });

    it('the shared registry instance is a DeadLetterReplayRegistry', () => {
        expect(deadLetterReplayRegistry).toBeInstanceOf(DeadLetterReplayRegistry);
    });
});
