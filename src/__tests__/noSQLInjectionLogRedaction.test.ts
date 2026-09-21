import { logger } from '../services/logger.service';
import { MicroserviceSecurityService, MicroserviceSecurityConfig } from '../security/MicroserviceSecurityService';
import { SecurityValidator } from '../security/SecurityValidator';

/**
 * NoSQL injection tespitinde LOG SIZINTISI testi (TASK-MUAYOM0JT6EVG)
 *
 * 21/09/2026'ya kadar `getNoSQLSanitizerMiddleware` bir injection yakaladiginda
 * `JSON.stringify(req.body)` ile GOVDENIN TAMAMINI `logger.warn` ile basiyordu;
 * `SecurityValidator.detectNoSQLInjection` ayni girdiyi iki kez daha basiyordu
 * (tehlikeli operatorun DEGERI + "tam input"). `/api/users/signin` gibi bir uca
 * gelen `{"email":{"$ne":null},"password":"..."}` isteginde bu, parolanin DUZ
 * METIN log satirina dusmesi demekti.
 *
 * Bu dosya BICIME degil SIZINTIYA bakiyor: gercek middleware gercek bir istekle
 * calistirilir, `logger`'in TUM cagrilarinin argumanlari serilestirilir ve icinde
 * hassas DEGER aranir. Teshis degeri ayrica kilitlenir — operator adi ve alan adi
 * log'da KALMALIDIR, yoksa maskeleme guvenlik olayini korlestirmis olur.
 */

const FAKE_PASSWORD = 'FAKE_PASSWORD_VALUE';
const FAKE_TOKEN = 'FAKE_TOKEN_VALUE';

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

// RateLimiter / BruteForceProtection yalnizca saklar; middleware yolu Redis'e dokunmaz.
const fakeRedisClient = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    on: jest.fn()
} as any;

/** logger'in tum seviyelerini yakalar; her cagrinin tum argumanlarini metne cevirir. */
const captureLogger = () => {
    const lines: string[] = [];
    const record = (...args: unknown[]) => {
        lines.push(args.map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '));
    };
    const spies = (['warn', 'info', 'error', 'debug'] as const).map(level =>
        jest.spyOn(logger, level).mockImplementation(record as any)
    );
    return {
        text: () => lines.join('\n'),
        restore: () => spies.forEach(spy => spy.mockRestore())
    };
};

const runMiddleware = (service: MicroserviceSecurityService, req: any) => {
    const middleware = service.getNoSQLSanitizerMiddleware();
    let forwarded: unknown = 'NOT_CALLED';
    middleware(req, {} as any, ((error?: unknown) => {
        forwarded = error;
    }) as any);
    return forwarded;
};

describe('NoSQL injection tespitinde hassas deger log sizintisi (TASK-MUAYOM0JT6EVG)', () => {
    let service: MicroserviceSecurityService;
    let capture: ReturnType<typeof captureLogger>;

    beforeEach(() => {
        capture = captureLogger();
        service = new MicroserviceSecurityService(config, fakeRedisClient);
    });

    afterEach(() => {
        capture.restore();
    });

    describe('SIZINTI — hassas DEGER log satirina dusmemeli', () => {
        it('gövdedeki parola, body injection yakalandiginda loglanmaz', () => {
            const forwarded = runMiddleware(service, {
                body: { email: { $ne: null }, password: FAKE_PASSWORD },
                params: {},
                query: {}
            });

            expect(forwarded).toBeInstanceOf(Error);
            expect(capture.text()).not.toContain(FAKE_PASSWORD);
        });

        it('query icindeki token, query injection yakalandiginda loglanmaz', () => {
            const forwarded = runMiddleware(service, {
                body: undefined,
                params: {},
                query: { filter: { $where: '1==1' }, token: FAKE_TOKEN }
            });

            expect(forwarded).toBeInstanceOf(Error);
            expect(capture.text()).not.toContain(FAKE_TOKEN);
        });

        it('params icindeki hassas deger, params injection yakalandiginda loglanmaz', () => {
            const forwarded = runMiddleware(service, {
                body: undefined,
                params: { id: { $gt: '' }, secret: FAKE_TOKEN },
                query: {}
            });

            expect(forwarded).toBeInstanceOf(Error);
            expect(capture.text()).not.toContain(FAKE_TOKEN);
        });

        it('tehlikeli operatorun DEGERI de loglanmaz (operatorun icindeki sir)', () => {
            const forwarded = runMiddleware(service, {
                body: { password: { $in: [FAKE_PASSWORD] } },
                params: {},
                query: {}
            });

            expect(forwarded).toBeInstanceOf(Error);
            expect(capture.text()).not.toContain(FAKE_PASSWORD);
        });

        it('SecurityValidator.detectNoSQLInjection dogrudan cagrildiginda da deger sizmaz', () => {
            const validator = new SecurityValidator({});

            expect(validator.detectNoSQLInjection({ email: { $ne: null }, password: FAKE_PASSWORD })).toBe(true);
            expect(capture.text()).not.toContain(FAKE_PASSWORD);
        });

        it('temiz bir istekte gövde hic loglanmaz (kosulsuz dump kalmadi)', () => {
            const forwarded = runMiddleware(service, {
                body: { email: 'user@example.com', password: FAKE_PASSWORD },
                params: {},
                query: {}
            });

            expect(forwarded).toBeUndefined();
            expect(capture.text()).not.toContain(FAKE_PASSWORD);
        });
    });

    describe('TESHIS DEGERI — maskeleme guvenlik olayini korlestirmemeli', () => {
        it('yakalanan operator ve alan adi log satirinda kalir', () => {
            runMiddleware(service, {
                body: { email: { $ne: null }, password: FAKE_PASSWORD },
                params: {},
                query: {}
            });

            const text = capture.text();
            expect(text).toContain('$ne');
            expect(text).toContain('email');
        });

        it('injection kaynagi (body/params/query) log satirindan ayirt edilebilir', () => {
            runMiddleware(service, {
                body: undefined,
                params: {},
                query: { filter: { $where: '1==1' } }
            });

            expect(capture.text()).toContain('query');
        });
    });

    describe('REGRESYON — tespit ve reddetme davranisi degismedi', () => {
        it('injection iceren istek BadRequestError ile reddedilir', () => {
            const forwarded = runMiddleware(service, {
                body: { email: { $ne: null } },
                params: {},
                query: {}
            }) as any;

            expect(forwarded).toBeInstanceOf(Error);
            expect(forwarded.statusCode).toBe(400);
        });

        it('temiz istek next() ile gecer ve gövde sanitize edilir', () => {
            const req: any = { body: { email: 'user@example.com' }, params: {}, query: {} };
            const forwarded = runMiddleware(service, req);

            expect(forwarded).toBeUndefined();
            expect(req.body.email).toBeDefined();
        });
    });
});
