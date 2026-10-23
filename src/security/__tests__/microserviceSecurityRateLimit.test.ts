import { MicroserviceSecurityService, DEFAULT_AUTHENTICATED_MAX_REQUESTS } from '../MicroserviceSecurityService';

// UC-970: servis güvenlik katmanının istek sınırı yapılandırması

const fakeRedis = {} as any;

const limiterConfig = (svc: MicroserviceSecurityService) => (svc.rateLimiter as any).config;

describe('MicroserviceSecurityService — istek sınırı (UC-970)', () => {
    const saved = { ...process.env };
    afterEach(() => { process.env = { ...saved }; });

    const make = (cfg: any = {}) => new MicroserviceSecurityService(
        { serviceName: 'reporting', maxRequestsPerWindow: 100, ...cfg } as any,
        fakeRedis
    );

    it('anonim limit servisin kendi maxRequestsPerWindow\'unda kalır', () => {
        expect(limiterConfig(make()).maxRequests).toBe(100);
    });

    it('kimlikli limit verilmezse varsayılan 1500', () => {
        delete process.env.RATE_LIMIT_AUTHENTICATED_MAX_REQUESTS;
        expect(DEFAULT_AUTHENTICATED_MAX_REQUESTS).toBe(1500);
        expect(limiterConfig(make()).authenticatedMaxRequests).toBe(1500);
    });

    it('RATE_LIMIT_AUTHENTICATED_MAX_REQUESTS ile ayarlanır', () => {
        process.env.RATE_LIMIT_AUTHENTICATED_MAX_REQUESTS = '2400';
        expect(limiterConfig(make()).authenticatedMaxRequests).toBe(2400);
    });

    it('geçersiz env değeri varsayılana düşer', () => {
        process.env.RATE_LIMIT_AUTHENTICATED_MAX_REQUESTS = 'abc';
        expect(limiterConfig(make()).authenticatedMaxRequests).toBe(DEFAULT_AUTHENTICATED_MAX_REQUESTS);
        process.env.RATE_LIMIT_AUTHENTICATED_MAX_REQUESTS = '0';
        expect(limiterConfig(make()).authenticatedMaxRequests).toBe(DEFAULT_AUTHENTICATED_MAX_REQUESTS);
    });

    it('servisin açık değeri env ve varsayılandan üstündür', () => {
        process.env.RATE_LIMIT_AUTHENTICATED_MAX_REQUESTS = '2400';
        expect(limiterConfig(make({ authenticatedMaxRequestsPerWindow: 500 })).authenticatedMaxRequests).toBe(500);
    });

    it('servis adı limitleyiciye geçer (429 gövdesi + metrik etiketi)', () => {
        expect(limiterConfig(make()).serviceName).toBe('reporting');
    });

    describe('anahtar üretimi', () => {
        const key = (req: any) => limiterConfig(make()).keyGenerator(req);

        it('kimliksiz istek IP kovası', () => {
            expect(key({ ip: '1.2.3.4' })).toBe('reporting_rate_limit:ip:1.2.3.4');
        });

        it('kimlikli istek kullanıcı kovası', () => {
            expect(key({ ip: '1.2.3.4', currentUser: { id: 'u1' } })).toBe('reporting_rate_limit:user:u1');
        });

        it('taklitte admin müşterinin kovasını tüketmez', () => {
            const customer = key({ ip: '1.2.3.4', currentUser: { id: 'cust1' } });
            const admin = key({ ip: '1.2.3.4', currentUser: { id: 'cust1', isImpersonating: true, adminId: 'adm1' } });
            expect(admin).toBe('reporting_rate_limit:user:cust1:admin:adm1');
            expect(admin).not.toBe(customer);
        });

        it('adminId olmadan isImpersonating bayrağı müşteri kovasında kalır', () => {
            expect(key({ ip: '1.2.3.4', currentUser: { id: 'cust1', isImpersonating: true } }))
                .toBe('reporting_rate_limit:user:cust1');
        });
    });
});
