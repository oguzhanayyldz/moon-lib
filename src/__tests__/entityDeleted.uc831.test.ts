/**
 * UC-831 — EntityDeleted yayın/tüketim sözleşmesi.
 *
 * - F-08: BaseModernEntityDeletedListener'daki bellek içi hız sınırı aynı kullanıcının art arda gelen meşru olaylarını
 *   reddediyordu (tekil olayda 1 sn); reddedilen olay yeniden teslim bütçesi bitince kayboluyordu.
 * - F-07: 100'den uzun liste tüketicide kalıcı hataydı; yayıncı tarafı writeEntityDeletedEventsToOutbox ile parçalar.
 * - F-06: yardımcı outbox yazım hatasını yutmaz, çağırana fırlatır.
 */
import { BaseModernEntityDeletedListener } from '../events/listeners/BaseModernEntityDeletedListener';
import { EntityDeletedEvent, Subjects } from '../common';
import { createFakeStan } from '../test/fakes/eventDeliveryHarness';
import {
    chunkEntityDeletedList,
    ENTITY_DELETED_MAX_LIST,
    writeEntityDeletedEventsToOutbox
} from '../utils/entityDeletedOutbox.util';
import { OptimisticLockingUtil } from '../utils/optimisticLocking.util';
import { DatabaseConnectionError } from '../common/errors/database-connection-error';

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

const USER_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';

const objectId = (n: number) => n.toString(16).padStart(24, '0');

const item = (n: number) => ({
    id: objectId(n),
    entity: 'uc831widget',
    timestamp: new Date().toISOString(),
    userId: USER_ID
});

class TestEntityDeletedListener extends BaseModernEntityDeletedListener {
    protected readonly serviceName = 'uc831test';
    readonly queueGroupName = 'uc831test-service';
    protected readonly tracer = undefined;
    readonly deleted: string[] = [];

    protected isEntityManagedByService(entityType: string): boolean {
        return entityType === 'uc831widget';
    }

    protected async legacyFallback(entity: { entity: string; entityId: string }): Promise<void> {
        this.deleted.push(entity.entityId);
    }
}

const newListener = () => new TestEntityDeletedListener(createFakeStan() as any);

describe('UC-831 BaseModernEntityDeletedListener', () => {
    it('F-08: aynı kullanıcıdan art arda 10 tekil olay ilk teslimde işlenir', async () => {
        const listener = newListener();
        const results = await Promise.allSettled(
            Array.from({ length: 10 }, (_, i) => listener.processEvent({ entity: 'uc831widget', list: [item(i + 1)] } as EntityDeletedEvent['data']))
        );

        expect(results.filter(r => r.status === 'rejected')).toEqual([]);
        expect(listener.deleted).toHaveLength(10);
    });

    it('F-08: 2-10 öğeli küçük toplu olaylar art arda reddedilmez', async () => {
        const listener = newListener();
        await listener.processEvent({ entity: 'uc831widget', list: [item(1), item(2)] } as EntityDeletedEvent['data']);
        await listener.processEvent({ entity: 'uc831widget', list: [item(3), item(4)] } as EntityDeletedEvent['data']);

        expect(listener.deleted).toHaveLength(4);
    });

    it('F-07: 100den uzun liste kalıcı hata değildir, tüm öğeler silinir', async () => {
        const listener = newListener();
        const list = Array.from({ length: 150 }, (_, i) => item(i + 1));

        await expect(listener.processEvent({ entity: 'uc831widget', list } as EntityDeletedEvent['data'])).resolves.toBeUndefined();
        expect(listener.deleted).toHaveLength(150);
    });

    it('girdi doğrulaması korunur: boş liste ve geçersiz kimlik reddedilir', async () => {
        const listener = newListener();
        await expect(listener.processEvent({ entity: 'uc831widget', list: [] } as any)).rejects.toThrow('list cannot be empty');
        await expect(listener.processEvent({ entity: 'uc831widget', list: [{ ...item(1), id: 'x' }] } as any))
            .rejects.toThrow('valid MongoDB ObjectId');
        expect(listener.deleted).toHaveLength(0);
    });
});

describe('UC-831 writeEntityDeletedEventsToOutbox', () => {
    const fakeOutbox = () => {
        const built: any[] = [];
        const model = {
            build: jest.fn((attrs: any) => {
                const doc = { ...attrs, save: jest.fn() };
                built.push(doc);
                return doc;
            })
        };
        return { model, built };
    };

    afterEach(() => jest.restoreAllMocks());

    it('250 kalem → 100/100/50 üç outbox satırı, tüketicide 250 silme', async () => {
        const save = jest.spyOn(OptimisticLockingUtil, 'saveWithRetry').mockResolvedValue(undefined as any);
        const { model, built } = fakeOutbox();
        const list = Array.from({ length: 250 }, (_, i) => item(i + 1));

        await expect(writeEntityDeletedEventsToOutbox(model as any, list)).resolves.toBe(3);

        expect(save).toHaveBeenCalledTimes(3);
        expect(built.map(b => b.payload.list.length)).toEqual([100, 100, 50]);
        expect(built.every(b => b.eventType === Subjects.EntityDeleted && b.status === 'pending' && b.payload.entity === 'uc831widget')).toBe(true);
        expect(built.flatMap(b => b.payload.list.map((e: any) => e.id))).toEqual(list.map(e => e.id));

        const listener = newListener();
        for (const b of built) {
            await listener.processEvent(b.payload);
        }
        expect(listener.deleted).toHaveLength(250);
    });

    it('outbox yazımı düşerse 500lük hata fırlatır (yutmaz)', async () => {
        jest.spyOn(OptimisticLockingUtil, 'saveWithRetry').mockRejectedValue(new Error('mongo down'));
        const { model } = fakeOutbox();

        const result = writeEntityDeletedEventsToOutbox(model as any, [item(1)]);
        await expect(result).rejects.toBeInstanceOf(DatabaseConnectionError);
        await expect(result).rejects.toMatchObject({ statusCode: 500 });
    });

    it('boş/undefined kayıtlar ayıklanır, boş listede satır yazılmaz', async () => {
        const save = jest.spyOn(OptimisticLockingUtil, 'saveWithRetry').mockResolvedValue(undefined as any);
        const { model } = fakeOutbox();

        await expect(writeEntityDeletedEventsToOutbox(model as any, [undefined, null])).resolves.toBe(0);
        expect(save).not.toHaveBeenCalled();
        expect(chunkEntityDeletedList([item(1), undefined, item(2)], 1)).toHaveLength(2);
    });

    it('parça boyutu sınırı 100 ve geçersiz boyut reddedilir', () => {
        expect(ENTITY_DELETED_MAX_LIST).toBe(100);
        expect(chunkEntityDeletedList(Array.from({ length: 101 }, (_, i) => item(i + 1))).map(c => c.length)).toEqual([100, 1]);
        expect(() => chunkEntityDeletedList([item(1)], 0)).toThrow('Invalid EntityDeleted chunk size');
    });
});
