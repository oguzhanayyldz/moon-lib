import { logger } from '../services/logger.service';
import { BruteForceProtection } from '../security/BruteForceProtection';
import { MicroserviceSecurityService, MicroserviceSecurityConfig } from '../security/MicroserviceSecurityService';
import { SecurityValidator } from '../security/SecurityValidator';

/**
 * UC-1220 (I, J) + UC-1222: güvenlik katmanı tutarlılığı.
 *  - getStatus hata yolunda bilinçli fail-open, ama `warn` loglanır (K-573869)
 *  - sanitizeInput hatada ham girdi DÖNMEZ (validateInput ile tutarlı kapalı davranış)
 *  - loginProtection 429 gövdesi `errors[].message` çeviri anahtarını taşır
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
    maxInputLength: 1000
};

const fakeRedisClient = { get: jest.fn(), set: jest.fn(), del: jest.fn(), incr: jest.fn(), expire: jest.fn(), on: jest.fn() } as any;

/** Okunurken fırlatan girdi: sanitize bu anahtarı gezerken hata verir. */
const poisonedInput = () => Object.defineProperty({}, 'boom', {
    enumerable: true,
    get() { throw new Error('getter boom'); }
});

describe('UC-1220 I — getStatus hata yolu: fail-open + warn', () => {
    let warn: jest.SpyInstance;
    let error: jest.SpyInstance;
    beforeEach(() => {
        warn = jest.spyOn(logger, 'warn').mockImplementation((() => undefined) as any);
        error = jest.spyOn(logger, 'error').mockImplementation((() => undefined) as any);
    });
    afterEach(() => jest.restoreAllMocks());

    it('BruteForceProtection.getStatus fırlatırsa girişe izin verir ve warn loglar', async () => {
        const service = new MicroserviceSecurityService(config, fakeRedisClient);
        jest.spyOn(service.bruteForceProtection, 'getStatus').mockRejectedValue(new Error('redis down'));

        await expect(service.getStatus('user@example.com')).resolves.toEqual({ allowed: true });

        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0][0])).toContain('fail-open');
        expect(error).not.toHaveBeenCalled();
    });
});

describe('UC-1220 J — sanitizeInput kapalı davranış', () => {
    beforeEach(() => {
        jest.spyOn(logger, 'error').mockImplementation((() => undefined) as any);
        jest.spyOn(logger, 'warn').mockImplementation((() => undefined) as any);
    });
    afterEach(() => jest.restoreAllMocks());

    it('temizlenemeyen girdi ham dönmez, fırlatılır', () => {
        const validator = new SecurityValidator();
        expect(() => validator.sanitizeInput(poisonedInput())).toThrow('Input sanitization failed');
    });

    it('sağlıklı girdi etkilenmez', () => {
        const validator = new SecurityValidator();
        expect(validator.sanitizeInput({ name: 'ok' })).toEqual({ name: 'ok' });
    });

    it('NoSQL middleware sanitize hatasında isteği hataya yönlendirir (ham girdi req\'e yazılmaz)', () => {
        const service = new MicroserviceSecurityService(config, fakeRedisClient);
        jest.spyOn((service as any).validator, 'detectNoSQLInjection').mockReturnValue(false);
        jest.spyOn((service as any).validator, 'sanitizeInput').mockImplementation(() => {
            throw new Error('Input sanitization failed');
        });
        const req: any = { body: { a: 1 }, params: {}, query: {} };
        let forwarded: unknown = 'NOT_CALLED';
        service.getNoSQLSanitizerMiddleware()(req, {} as any, ((e?: unknown) => { forwarded = e; }) as any);

        expect(forwarded).toBeInstanceOf(Error);
        expect(req.body).toEqual({ a: 1 });
    });
});

describe('UC-1222 — loginProtection 429 gövdesi', () => {
    afterEach(() => jest.restoreAllMocks());

    it('errors[].message çeviri anahtarını taşır, mevcut alanlar kalır', async () => {
        jest.spyOn(logger, 'warn').mockImplementation((() => undefined) as any);
        const protection = new BruteForceProtection(fakeRedisClient);
        const blockExpiresAt = new Date(Date.now() + 60_000);
        jest.spyOn(protection, 'getStatus').mockResolvedValue({
            allowed: false, attemptsRemaining: 0, timeUntilReset: 60_000, isBlocked: true, blockExpiresAt
        } as any);
        const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        await protection.loginProtection()({ ip: '1.2.3.4' } as any, res, next);

        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            error: expect.stringContaining('Too many failed login attempts'),
            retryAfter: 60,
            blockExpiresAt,
            errors: [{ message: 'errors.auth.tooManyLoginAttempts' }]
        }));
        expect(next).not.toHaveBeenCalled();
    });
});
