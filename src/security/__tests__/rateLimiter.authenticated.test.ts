import { RateLimiter } from '../RateLimiter';
import { HttpMetrics } from '../../middleware/httpMetrics';
import { logger } from '../../services/logger.service';

// UC-970: kimlikli kullanıcıya ayrı limit, anonim (IP) isteğe eski sıkı limit,
// 429'da pencere başına tek log + http_rate_limited_total sayacı.

function makeRedis() {
    const store = new Map<string, number>();
    return {
        store,
        incr: jest.fn(async (k: string) => {
            const v = (store.get(k) || 0) + 1;
            store.set(k, v);
            return v;
        }),
        expire: jest.fn(async () => true)
    } as any;
}

function makeReq(opts: { userId?: string; path?: string; impersonatingAdmin?: string } = {}) {
    const currentUser = opts.userId
        ? {
            id: opts.userId,
            ...(opts.impersonatingAdmin ? { isImpersonating: true, adminId: opts.impersonatingAdmin } : {})
        }
        : undefined;
    return {
        ip: '10.1.2.3',
        method: 'GET',
        path: opts.path || '/api/reporting/v2/dashboard/summary',
        currentUser,
        connection: {}
    } as any;
}

function makeRes() {
    const res: any = {
        statusCode: 200,
        headers: {} as Record<string, string>,
        body: undefined as any,
        set(h: Record<string, string>) { Object.assign(this.headers, h); return this; },
        status(c: number) { this.statusCode = c; return this; },
        json(b: any) { this.body = b; return this; }
    };
    return res;
}

async function hit(mw: any, req: any) {
    const res = makeRes();
    const next = jest.fn();
    await mw(req, res, next);
    return { res, passed: next.mock.calls.length === 1 };
}

async function rateLimitedCount(labels: Record<string, string>): Promise<number> {
    const metric = await HttpMetrics.httpRateLimitedTotal.get();
    const row = metric.values.find(v =>
        Object.entries(labels).every(([k, val]) => (v.labels as any)[k] === val));
    return row ? row.value : 0;
}

describe('RateLimiter — kimlikli kullanıcı limiti (UC-970)', () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
        HttpMetrics.reset();
        warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => logger as any);
    });

    afterEach(() => {
        warnSpy.mockRestore();
    });

    const keyGen = (req: any) => req.currentUser?.id
        ? `svc_rate_limit:user:${req.currentUser.id}`
        : `svc_rate_limit:ip:${req.ip}`;

    const make = (cfg: any = {}) => new RateLimiter(makeRedis(), {
        windowMs: 15 * 60 * 1000,
        maxRequests: 2,
        authenticatedMaxRequests: 5,
        serviceName: 'reporting',
        keyGenerator: keyGen,
        ...cfg
    }).middleware();

    it('anonim istek maxRequests sonrasında 429 alır', async () => {
        const mw = make();
        expect((await hit(mw, makeReq())).passed).toBe(true);
        expect((await hit(mw, makeReq())).passed).toBe(true);
        const third = await hit(mw, makeReq());
        expect(third.passed).toBe(false);
        expect(third.res.statusCode).toBe(429);
        expect(third.res.headers['X-RateLimit-Limit']).toBe('2');
    });

    it('kimlikli kullanıcı maxRequests\'i aşıp authenticatedMaxRequests\'e kadar geçer', async () => {
        const mw = make();
        for (let i = 1; i <= 5; i++) {
            const r = await hit(mw, makeReq({ userId: 'u1' }));
            expect(r.passed).toBe(true);
            expect(r.res.headers['X-RateLimit-Limit']).toBe('5');
            expect(r.res.headers['X-RateLimit-Remaining']).toBe(String(5 - i));
        }
        const sixth = await hit(mw, makeReq({ userId: 'u1' }));
        expect(sixth.passed).toBe(false);
        expect(sixth.res.statusCode).toBe(429);
    });

    it('authenticatedMaxRequests verilmezse kimlikli kullanıcı da maxRequests\'e tabidir (geriye uyum)', async () => {
        const mw = make({ authenticatedMaxRequests: undefined });
        await hit(mw, makeReq({ userId: 'u1' }));
        await hit(mw, makeReq({ userId: 'u1' }));
        const third = await hit(mw, makeReq({ userId: 'u1' }));
        expect(third.res.statusCode).toBe(429);
        expect(third.res.headers['X-RateLimit-Limit']).toBe('2');
    });

    it('429 gövdesi servis adını ve retryAfter\'ı taşır', async () => {
        const mw = make();
        await hit(mw, makeReq());
        await hit(mw, makeReq());
        const r = await hit(mw, makeReq());
        expect(r.res.body.service).toBe('reporting');
        expect(r.res.body.retryAfter).toBeGreaterThan(0);
        expect(r.res.body.retryAfter).toBeLessThanOrEqual(15 * 60);
        expect(r.res.headers['X-RateLimit-RetryAfter']).toBe(String(r.res.body.retryAfter));
    });

    it('her 429 sayaca yazılır; log anahtar+pencere başına yalnız bir kez', async () => {
        const mw = make();
        for (let i = 0; i < 2; i++) await hit(mw, makeReq());
        for (let i = 0; i < 3; i++) await hit(mw, makeReq());
        for (let i = 0; i < 7; i++) await hit(mw, makeReq({ userId: 'u1' }));

        expect(await rateLimitedCount({ service: 'reporting', scope: 'ip' })).toBe(3);
        expect(await rateLimitedCount({ service: 'reporting', scope: 'user' })).toBe(2);

        const logs = warnSpy.mock.calls.filter(c => c[1]?.event === 'rate_limit_exceeded');
        expect(logs).toHaveLength(2);
        const userLog = logs.find(c => c[1].scope === 'user')![1];
        expect(userLog).toMatchObject({
            service: 'reporting',
            method: 'GET',
            route: '/api/reporting/v2/dashboard/summary',
            userId: 'u1',
            limit: 5
        });
        // IP log'a açık yazılmaz
        expect(JSON.stringify(logs)).not.toContain('10.1.2.3');
        expect(userLog.ip).toBe('10.1.2.x');
    });

    it('sayaç etiketinde kimlikler :id\'ye indirgenir', async () => {
        const mw = make({ maxRequests: 0, authenticatedMaxRequests: undefined });
        await hit(mw, makeReq({ path: '/api/orders/64b7f0c2a1b2c3d4e5f60718/items' }));
        expect(await rateLimitedCount({ route: '/api/orders/:id/items', scope: 'ip' })).toBe(1);
    });

    it('taklitte log adminId\'yi taşır', async () => {
        const mw = make({ authenticatedMaxRequests: 1 });
        await hit(mw, makeReq({ userId: 'cust1', impersonatingAdmin: 'adm1' }));
        await hit(mw, makeReq({ userId: 'cust1', impersonatingAdmin: 'adm1' }));
        const log = warnSpy.mock.calls.find(c => c[1]?.event === 'rate_limit_exceeded')![1];
        expect(log.userId).toBe('cust1');
        expect(log.adminId).toBe('adm1');
    });

    it('Redis hatasında istek geçer (fail open)', async () => {
        const redis = makeRedis();
        redis.incr.mockRejectedValue(new Error('redis down'));
        const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => logger as any);
        const mw = new RateLimiter(redis, { maxRequests: 0, keyGenerator: keyGen }).middleware();
        const r = await hit(mw, makeReq({ userId: 'u1' }));
        errSpy.mockRestore();
        expect(r.passed).toBe(true);
    });
});
