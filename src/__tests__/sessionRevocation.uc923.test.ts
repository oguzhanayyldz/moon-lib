/**
 * UC-923 — oturum iptali ortak yardimcisi (servis kopyalari UC-921/UC-922'nin tek hali).
 *
 * - Izdusum modeli: TTL indeksi GERCEK Mongo'da kurulur (N1/H3: kopyada TTL silinince test yesil kaliyordu).
 * - Dinleyici: `$max` + upsert, kucuk harf anahtar, gecersiz damga atlanir, hata firlar.
 * - eventId: kullanici + damga basina tekil (N1/H4: sabit eventId'de farkli kullanicilarin eszamanli
 *   olaylari kilit icin cekisiyordu). Eszamanlilik testi RetryableListener'in GERCEK kilidiyle kosar.
 * - `requireFreshSessionOnWrites`: okuma gecer, iptal edilmis oturumun yazmasi 401, okuma hatasi 503
 *   (N3), `'propagate'` eski 400 davranisi.
 *
 * Redis bellek ici sahte (SET NX EX gercek), NATS sahte, Mongo gercek (mongodb-memory-server).
 */
import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
    SESSION_REVOCATION_TTL_SECONDS,
    createSessionRevocationLookup,
    createSessionRevocationModel,
    sessionRevocationSchema
} from '../models/sessionRevocation.schema';
import { BaseUserSessionsRevokedListener, SessionRevokedSpan } from '../events/listeners/BaseUserSessionsRevokedListener';
import {
    requireFreshSession,
    requireFreshSessionOnWrites,
    SessionRevocationLookup
} from '../common/middlewares/require-fresh-session';
import { errorHandler } from '../common/middlewares/error-handler';
import { NotAuthorizedError } from '../common/errors/not-authorized-error';
import { ServiceUnavailableError } from '../common/errors/service-unavailable-error';
import { UserRole } from '../common/types/user-role';
import { redisWrapper } from '../services/redisWrapper.service';
import { InMemoryRedis } from '../test/fakes/inMemoryRedis';
import { createFakeMessage, createFakeStan, wasAcked } from '../test/fakes/eventDeliveryHarness';

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

jest.setTimeout(60000);

const span = (): SessionRevokedSpan => ({ setTag: jest.fn(), finish: jest.fn() });
const tracer = { startSpan: jest.fn(() => span()) };

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

class TestListener extends BaseUserSessionsRevokedListener {
    queueGroupName = 'uc923-test';
    protected serviceName = 'Test';
    protected tracer = tracer;
    applyDelayMs = 0;

    eventId(data: { userId: string; revokedAt: string }) {
        return this.getEventId(data);
    }

    run(data: { userId: string; revokedAt: string }) {
        return this.processEvent(data);
    }

    protected async applyRevocation(userId: string, revokedAt: Date, s: SessionRevokedSpan): Promise<void> {
        if (this.applyDelayMs) await sleep(this.applyDelayMs);
        await super.applyRevocation(userId, revokedAt, s);
    }
}

let mms: MongoMemoryServer;
let connection: mongoose.Connection;

beforeAll(async () => {
    mms = await MongoMemoryServer.create({ binary: { version: '6.0.4' } });
    connection = await mongoose.createConnection(mms.getUri()).asPromise();
});

afterAll(async () => {
    await connection?.close();
    await mms?.stop();
});

beforeEach(async () => {
    (redisWrapper.client as unknown as InMemoryRedis).flushAll();
    await createSessionRevocationModel(connection).deleteMany({});
});

const newListener = () => new TestListener(createFakeStan().client, { lockTimeoutSec: 10 }, connection);

const T1 = '2026-10-29T10:00:00.000Z';
const T2 = '2026-10-29T11:00:00.000Z';

describe('SessionRevocation izdusumu (N1/H3 TTL)', () => {
    it('semada sessionsRevokedAt uzerinde 1 gunluk TTL indeksi var', () => {
        expect(SESSION_REVOCATION_TTL_SECONDS).toBe(86400);
        const ttl = sessionRevocationSchema.indexes().find(([fields]) => 'sessionsRevokedAt' in fields);
        expect(ttl).toEqual([{ sessionsRevokedAt: 1 }, expect.objectContaining({ expireAfterSeconds: 86400 })]);
    });

    it('gercek Mongo: TTL indeksi kurulur, userId tekildir', async () => {
        const SessionRevocation = createSessionRevocationModel(connection);
        await SessionRevocation.syncIndexes();
        const indexes = await SessionRevocation.collection.indexes();

        expect(SessionRevocation.collection.collectionName).toBe('sessionrevocations');
        expect(indexes.find(i => i.key.sessionsRevokedAt === 1)).toEqual(
            expect.objectContaining({ expireAfterSeconds: 86400 })
        );
        expect(indexes.find(i => i.key.userId === 1)).toEqual(expect.objectContaining({ unique: true }));
    });

    it('ayni baglantida ikinci cagri ayni modeli dondurur (OverwriteModelError yok)', () => {
        expect(createSessionRevocationModel(connection)).toBe(createSessionRevocationModel(connection));
    });

    it('lookup kucuk harfe cevirir, kayit yoksa null', async () => {
        await createSessionRevocationModel(connection).create({ userId: 'abc', sessionsRevokedAt: new Date(T1) });
        const lookup = createSessionRevocationLookup(connection);

        expect((await lookup('ABC'))?.sessionsRevokedAt).toEqual(new Date(T1));
        expect(await lookup('other')).toBeNull();
    });

    it('lookup okuma hatasini YUTMAZ (fail-closed; UC-921 N1 / W4)', async () => {
        const exec = jest.spyOn(mongoose.Query.prototype, 'exec').mockRejectedValueOnce(new Error('mongo down'));
        try {
            await expect(createSessionRevocationLookup(connection)('abc')).rejects.toThrow('mongo down');
        } finally {
            exec.mockRestore();
        }
    });
});

describe('BaseUserSessionsRevokedListener — izdusum yazimi', () => {
    it('kucuk harf anahtarla upsert eder; eski damga yeniyi geri almaz ($max)', async () => {
        const listener = newListener();
        await listener.run({ userId: 'USER-A', revokedAt: T2 });
        await listener.run({ userId: 'user-a', revokedAt: T1 });

        const docs = await createSessionRevocationModel(connection).find({}).lean();
        expect(docs).toHaveLength(1);
        expect(docs[0]).toEqual(expect.objectContaining({ userId: 'user-a', sessionsRevokedAt: new Date(T2) }));
    });

    it('gecersiz revokedAt yazilmaz ve firlatmaz (kalici hata, tekrar denenmez)', async () => {
        await newListener().run({ userId: 'u1', revokedAt: 'not-a-date' });
        expect(await createSessionRevocationModel(connection).countDocuments({})).toBe(0);
    });

    it('yazma hatasi firlar (RetryableListener tekrar dener)', async () => {
        const listener = newListener();
        jest.spyOn((listener as any).sessionRevocationModel, 'updateOne').mockRejectedValueOnce(new Error('mongo down'));
        await expect(listener.run({ userId: 'u1', revokedAt: T1 })).rejects.toThrow('mongo down');
    });
});

describe('BaseUserSessionsRevokedListener — eventId (N1/H4)', () => {
    it('kullanici ve damga basina tekil, ayni olayin tekrari ayni anahtar', () => {
        const listener = newListener();
        const a1 = listener.eventId({ userId: 'a', revokedAt: T1 });

        expect(listener.eventId({ userId: 'a', revokedAt: T1 })).toBe(a1);
        expect(listener.eventId({ userId: 'b', revokedAt: T1 })).not.toBe(a1);
        expect(listener.eventId({ userId: 'a', revokedAt: T2 })).not.toBe(a1);
    });

    it('iki kullanicinin eszamanli olayi kilit icin cekismez: ikisi de yazilir ve ack lenir', async () => {
        const listener = newListener();
        listener.applyDelayMs = 300;
        const a = { userId: 'user-a', revokedAt: T1 };
        const b = { userId: 'user-b', revokedAt: T1 };
        const msgA = createFakeMessage(a, 1);
        const msgB = createFakeMessage(b, 2);

        const runningA = listener.onMessage(a, msgA);
        await sleep(50);
        await listener.onMessage(b, msgB);
        await runningA;

        const userIds = (await createSessionRevocationModel(connection).find({}).lean()).map(d => d.userId).sort();
        expect({ userIds, ackedA: wasAcked(msgA), ackedB: wasAcked(msgB) })
            .toEqual({ userIds: ['user-a', 'user-b'], ackedA: true, ackedB: true });
    });
});

describe('requireFreshSessionOnWrites', () => {
    const REVOKED = { sessionsRevokedAt: new Date(T2) };
    const user = (sstIso: string) => ({
        id: 'owner-1', email: 'o@example.com', name: 'O', surname: 'O', role: UserRole.User,
        sst: new Date(sstIso).getTime()
    });

    const call = async (
        method: string,
        currentUser: unknown,
        lookup: SessionRevocationLookup,
        options?: Parameters<typeof requireFreshSessionOnWrites>[1]
    ) => {
        const next = jest.fn() as jest.MockedFunction<NextFunction>;
        requireFreshSessionOnWrites(lookup, options)({ method, currentUser } as Request, {} as Response, next);
        await sleep(0);
        expect(next).toHaveBeenCalledTimes(1);
        return next.mock.calls[0][0];
    };

    /** errorHandler'in verecegi HTTP durumu. */
    const statusOf = (err: unknown) => {
        const res = { status: jest.fn(() => res), send: jest.fn(() => res) } as unknown as Response;
        errorHandler(err, { method: 'POST', originalUrl: '/x' } as Request, res, jest.fn());
        return (res.status as jest.Mock).mock.calls[0][0];
    };

    it('okuma yontemleri esige bakmadan gecer', async () => {
        const lookup = jest.fn().mockResolvedValue(REVOKED);
        for (const method of ['GET', 'HEAD', 'OPTIONS']) {
            expect(await call(method, user(T1), lookup)).toBeUndefined();
        }
        expect(lookup).not.toHaveBeenCalled();
    });

    it('oturumsuz yazma (webhook) dokunulmadan gecer', async () => {
        const lookup = jest.fn();
        expect(await call('POST', undefined, lookup)).toBeUndefined();
        expect(lookup).not.toHaveBeenCalled();
    });

    it('iptalden once baslamis oturumun yazmasi 401, sonra baslamisinki gecer', async () => {
        const lookup = jest.fn().mockResolvedValue(REVOKED);
        const rejected = await call('DELETE', user(T1), lookup);
        expect(rejected).toBeInstanceOf(NotAuthorizedError);
        expect(statusOf(rejected)).toBe(401);
        expect(await call('PATCH', user('2026-10-29T12:00:00.000Z'), lookup)).toBeUndefined();
    });

    it('N3: okuma hatasi varsayilan 503 (fail-closed, ham hata yanita yazilmaz)', async () => {
        const err = await call('POST', user(T1), jest.fn().mockRejectedValue(new Error('mongo down')));
        expect(err).toBeInstanceOf(ServiceUnavailableError);
        expect(statusOf(err)).toBe(503);
        expect((err as unknown as ServiceUnavailableError).serializeErrors()).toEqual([{ message: 'Service temporarily unavailable' }]);
    });

    it("'propagate': kopyalarin eski davranisi — ham hata, errorHandler 400", async () => {
        const raw = new Error('mongo down');
        const err = await call('PUT', user(T1), jest.fn().mockRejectedValue(raw), { onLookupError: 'propagate' });
        expect(err).toBe(raw);
        expect(statusOf(err)).toBe(400);
    });

    it('sonraki katmanin senkron hatasi asili kalmaz: next(hata) ile iletilir', async () => {
        const boom = new Error('downstream');
        const next = jest.fn().mockImplementationOnce(() => { throw boom; }) as jest.MockedFunction<NextFunction>;
        requireFreshSessionOnWrites(jest.fn().mockResolvedValue(null))(
            { method: 'POST', currentUser: user(T1) } as unknown as Request, {} as Response, next
        );
        await sleep(0);
        expect(next.mock.calls).toEqual([[], [boom]]);
    });

    it('requireFreshSession: bos donen esleme istegi GECIRMEZ (ham hataya duser)', async () => {
        const raw = new Error('mongo down');
        const next = jest.fn() as jest.MockedFunction<NextFunction>;
        await requireFreshSession(jest.fn().mockRejectedValue(raw), { mapLookupError: () => undefined })(
            { currentUser: user(T1) } as unknown as Request, {} as Response, next
        );
        expect(next).toHaveBeenCalledWith(raw);
    });
});
