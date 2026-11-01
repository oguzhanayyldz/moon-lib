import { MicroserviceSecurityService, MicroserviceSecurityConfig } from '../security/MicroserviceSecurityService';
import { SecurityValidator } from '../security/SecurityValidator';
import { BadRequestError } from '../common/errors/bad-request-error';
import { logger } from '../services/logger.service';

/**
 * UC-1229 (B5): detectNoSQLInjection ozyinelemeliydi; ~1954 seviyede RangeError (Maximum call stack) atiyor,
 * istek 500 donuyordu. Derinlik siniri asildiginda istek 400 (BadRequestError) ile reddedilmeli.
 */
const config: MicroserviceSecurityConfig = {
    serviceName: 'test-service',
    apiPathRegex: /^\/api\/test\/?/,
    maxFileSize: 1024,
    allowedFileTypes: ['image/png'],
    maxRequestsPerWindow: 100,
    requestWindowMs: 60_000,
    bruteForceMaxAttempts: 5,
    bruteForceBlockDurationMs: 60_000,
    bruteForceWindowMs: 60_000,
    enableXSSProtection: true,
    enableSQLInjectionProtection: true,
    enableFileUploadValidation: true,
    enableCSP: true,
    enableHSTS: true,
    enableXFrameOptions: true,
    enableXContentTypeOptions: true,
    enableInputSanitization: true,
    maxInputLength: 1000
} as any;

const fakeRedisClient = { get: jest.fn(), set: jest.fn(), del: jest.fn(), incr: jest.fn(), expire: jest.fn(), on: jest.fn() } as any;

/** Yigin tasmasi olmasin diye ITERATIF kurulur. */
const nest = (depth: number, leaf: any = 'x'): any => {
    let node: any = leaf;
    for (let i = 0; i < depth; i++) node = { a: node };
    return node;
};

const nestArray = (depth: number): any => {
    let node: any = 'x';
    for (let i = 0; i < depth; i++) node = [node];
    return node;
};

const runMiddleware = (body: any): any => {
    const service = new MicroserviceSecurityService(config, fakeRedisClient);
    const mw = service.getNoSQLSanitizerMiddleware();
    const next = jest.fn();
    mw({ body, params: {}, query: {} } as any, {} as any, next);
    return next.mock.calls[0][0];
};

describe('UC-1229 — NoSQL tespiti derinlik siniri', () => {
    it('3000 derinlikte middleware RangeError degil BadRequestError (400) iletir', () => {
        const err = runMiddleware(nest(3000));
        expect(err).toBeInstanceOf(BadRequestError);
        expect(err).not.toBeInstanceOf(RangeError);
    });

    it('detectNoSQLInjection 3000 derinlikte firlatmaz, true doner', () => {
        const validator = new SecurityValidator(config as any);
        expect(() => validator.detectNoSQLInjection(nest(3000))).not.toThrow();
        expect(validator.detectNoSQLInjection(nest(3000))).toBe(true);
    });

    it('dizi icinde derin yuva da reddedilir', () => {
        const validator = new SecurityValidator(config as any);
        expect(validator.detectNoSQLInjection(nestArray(3000))).toBe(true);
    });

    it('normal derinlikte ($ne) enjeksiyon hala tespit edilir', () => {
        const validator = new SecurityValidator(config as any);
        expect(validator.detectNoSQLInjection(nest(10, { $ne: null }))).toBe(true);
        expect(runMiddleware({ filter: { user: { pass: { $gt: '' } } } })).toBeInstanceOf(BadRequestError);
    });

    it('sinir kenari: 100 seviye gecer, 101 seviye reddedilir', () => {
        const validator = new SecurityValidator(config as any);
        expect(validator.detectNoSQLInjection(nest(100))).toBe(false); // 100 ic ice nesne
        expect(validator.detectNoSQLInjection(nest(101))).toBe(true);
    });

    it('normal derinlikte temiz govde gecer', () => {
        const validator = new SecurityValidator(config as any);
        expect(validator.detectNoSQLInjection(nest(20))).toBe(false);
        expect(validator.detectNoSQLInjection(nest(50))).toBe(false);
        expect(runMiddleware({ name: 'ali', items: [{ sku: 'a' }] })).toBeUndefined();
    });

    // UC-1229 D1: derinlik reddi saldiri gibi gorunmemeli; gercek tespit eskisi gibi kalmali.
    describe('D1 — red sebebi ayrimi (mesaj + log)', () => {
        let warnSpy: jest.SpyInstance;
        beforeEach(() => { warnSpy = jest.spyOn(logger, 'warn').mockImplementation((() => logger) as any); });
        afterEach(() => warnSpy.mockRestore());
        const warnMessages = () => warnSpy.mock.calls.map(c => String(c[0]));

        it('derinlik reddi: istemci mesaji ve log "NoSQL injection" demez', () => {
            const err = runMiddleware(nest(3000));
            expect(err).toBeInstanceOf(BadRequestError);
            expect(err.message).toContain('çok derin');
            expect(err.message).not.toMatch(/injection/i);
            const msgs = warnMessages();
            expect(msgs.some(m => /derin/i.test(m))).toBe(true);
            expect(msgs.some(m => /NoSQL injection tespit edildi/i.test(m))).toBe(false);
        });

        it('gercek operator: eski mesaj ve eski log korunur', () => {
            const err = runMiddleware({ filter: { pass: { $gt: '' } } });
            expect(err).toBeInstanceOf(BadRequestError);
            expect(err.message).toBe('Güvenlik ihlali: Potansiyel NoSQL injection tespit edildi');
            expect(warnMessages()).toContain('NoSQL injection tespit edildi - istek reddedildi');
            expect(warnMessages().some(m => /derin/i.test(m))).toBe(false);
        });

        it('inspectNoSQLInput sebebi ayirir; detectNoSQLInjection ikisinde de true', () => {
            const v = new SecurityValidator(config as any);
            expect(v.inspectNoSQLInput(nest(101))).toBe('too_deep');
            expect(v.inspectNoSQLInput(nest(5, { $ne: null }))).toBe('injection');
            expect(v.inspectNoSQLInput(nest(100))).toBe('clean');
            expect(v.detectNoSQLInjection(nest(101))).toBe(true);
            expect(v.detectNoSQLInjection(nest(5, { $ne: null }))).toBe(true);
        });
    });
});
