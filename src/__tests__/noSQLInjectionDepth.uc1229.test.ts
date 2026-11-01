import { MicroserviceSecurityService, MicroserviceSecurityConfig } from '../security/MicroserviceSecurityService';
import { SecurityValidator } from '../security/SecurityValidator';
import { BadRequestError } from '../common/errors/bad-request-error';

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
});
