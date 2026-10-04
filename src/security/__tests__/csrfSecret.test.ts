import * as jwt from 'jsonwebtoken';
import { MicroserviceSecurityService } from '../MicroserviceSecurityService';

// CSRF belirteci koddaki sabit anahtarla imzalanmamalı (B-4): dağıtımlarda yalnız JWT_KEY var.

const fakeRedis = {} as any;

function run(mw: any, token?: string) {
    const req: any = { method: 'POST', headers: token ? { 'x-csrf-token': token } : {} };
    const res: any = { statusCode: 200, status(c: number) { this.statusCode = c; return this; }, json() { return this; } };
    const next = jest.fn();
    mw(req, res, next);
    return { status: res.statusCode, nextCalled: next.mock.calls.length === 1 };
}

describe('MicroserviceSecurityService — CSRF imza anahtarı', () => {
    const saved = { ...process.env };
    afterEach(() => { process.env = { ...saved }; });

    const make = () => new MicroserviceSecurityService({ serviceName: 'test' } as any, fakeRedis);

    it('JWT_KEY varken üretilen belirteç doğrulanır', () => {
        delete process.env.JWT_SECRET;
        delete process.env.CSRF_SECRET;
        process.env.JWT_KEY = 'unit-test-jwt-key';
        const svc = make();
        const result = run(svc.getJwtCsrfProtectionMiddleware(), svc.generateCsrfToken('u1'));
        expect(result.nextCalled).toBe(true);
    });

    it('koddaki sabit anahtarla imzalanmış belirteç reddedilir', () => {
        delete process.env.JWT_SECRET;
        delete process.env.CSRF_SECRET;
        process.env.JWT_KEY = 'unit-test-jwt-key';
        const forged = jwt.sign({ userId: 'x' }, 'moon-security-secret', { expiresIn: '5m' });
        const result = run(make().getJwtCsrfProtectionMiddleware(), forged);
        expect(result.status).toBe(403);
        expect(result.nextCalled).toBe(false);
    });

    it('oturum JWT_KEY ile imzalı JWT CSRF belirteci olarak kabul edilmez', () => {
        delete process.env.JWT_SECRET;
        delete process.env.CSRF_SECRET;
        process.env.JWT_KEY = 'unit-test-jwt-key';
        const sessionJwt = jwt.sign({ id: 'u1' }, 'unit-test-jwt-key', { expiresIn: '5m' });
        const result = run(make().getJwtCsrfProtectionMiddleware(), sessionJwt);
        expect(result.status).toBe(403);
    });
});
