import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// requireActiveSubscription abonelik durumunu Redis'ten okur; currentUser
// yalniz sessionId varsa Redis'e gider (bu testlerde yok).
const mockRedisGet = jest.fn();
jest.mock('../services/redisWrapper.service', () => ({
    redisWrapper: { client: { get: (...args: unknown[]) => mockRedisGet(...args) } }
}));

import { currentUser, hasPermission, hasPlatformPermission, isSubUser, getEffectiveUserId, UserPayload } from '../common/middlewares/current-user';
import { requireAuthAdmin } from '../common/middlewares/require-auth-admin';
import { requireActiveSubscription } from '../common/middlewares/require-active-subscription';
import { requireOnboarding } from '../common/middlewares/require-onboarding';
import { UserRole, parseUserRole } from '../common/types/user-role';
import { createAuditLogEntry } from '../utils/audit-helper';

/**
 * SEC-1-SESS-D (TASK-MU1IV0YVNG85F) — kati rol ayristirma.
 *
 * `normalizeRole` onceden `Number(role)` idi: `Number("") === 0`,
 * `Number(false) === 0`, `Number(" 0 ") === 0`, `Number([]) === 0` →
 * hepsi `UserRole.Admin`. Bilinmeyen/bozuk rol EN YUKSEK yetkiye
 * dusuyordu (fail-open). Beklenen: yalniz 0/1/2 ve "0"/"1"/"2" gecerli,
 * gerisi hicbir role eslenmez → her rol kapisinda red.
 */

const JWT_KEY = 'test-jwt-key-sess-d';

const runCurrentUser = (payload: Record<string, unknown>): UserPayload | undefined => {
    const token = jwt.sign(payload, JWT_KEY);
    const req = { session: { jwt: token } } as unknown as Request;
    currentUser(req, {} as Response, (() => undefined) as NextFunction);
    return req.currentUser;
};

const adminGatePasses = (user: UserPayload | undefined): boolean => {
    const req = { currentUser: user } as unknown as Request;
    let passed = false;
    try {
        requireAuthAdmin(req, {} as Response, (() => { passed = true; }) as NextFunction);
    } catch {
        passed = false;
    }
    return passed;
};

const basePayload = { id: 'u1', email: 'u1@example.com', name: 'U', surname: 'One' };

beforeAll(() => {
    process.env.JWT_KEY = JWT_KEY;
});

describe('parseUserRole — kati ayristirici', () => {
    it.each([
        [0, UserRole.Admin],
        [1, UserRole.User],
        [2, UserRole.SubUser],
        ['0', UserRole.Admin],
        ['1', UserRole.User],
        ['2', UserRole.SubUser]
    ])('%p → %p', (input, expected) => {
        expect(parseUserRole(input)).toBe(expected);
    });

    it.each([
        [''], [' '], [' 0 '], ['00'], ['0x0'], ['0.0'], ['1e0'], ['1.0'], ['+1'], ['-0'],
        ['Admin'], ['User'], ['SubUser'], [3], [-1], [1.5], [NaN], [Infinity],
        [true], [false], [null], [undefined], [[]], [[0]], [{}]
    ])('bilinmeyen deger %p → undefined (hicbir role eslenmez)', (input) => {
        expect(parseUserRole(input)).toBeUndefined();
    });
});

describe('currentUser + requireAuthAdmin — bozuk rol admin kapisini ACMAZ', () => {
    it.each([
        ['bos string', ''],
        ['bosluklu sifir', ' 0 '],
        ['hex sifir', '0x0'],
        ['false', false],
        ['bos dizi', []]
    ])('%s rolu → admin kapisi reddeder', (_label, role) => {
        const user = runCurrentUser({ ...basePayload, role });
        expect(user).toBeDefined();
        expect(adminGatePasses(user)).toBe(false);
    });

    it('gecerli string admin rolu ("0") → admin kapisi gecer (kontrol)', () => {
        const user = runCurrentUser({ ...basePayload, role: '0' });
        expect(user!.role).toBe(UserRole.Admin);
        expect(adminGatePasses(user)).toBe(true);
    });

    it('gecerli string kullanici rolu ("1") → admin kapisi reddeder, tam kullanici yetkisi (kontrol)', () => {
        const user = runCurrentUser({ ...basePayload, role: '1' });
        expect(user!.role).toBe(UserRole.User);
        expect(adminGatePasses(user)).toBe(false);
        expect(hasPermission(user!, 'orders', 'delete')).toBe(true);
    });
});

describe('currentUser + hasPermission — bozuk rol sahip yetkisi KAZANMAZ', () => {
    it.each([
        ['true', true],
        ['bilimsel gosterim', '1e0'],
        ['ondalik', '1.0'],
        ['tek elemanli dizi', [1]]
    ])('%s rolu → tam kullanici yetkisi verilmez', (_label, role) => {
        const user = runCurrentUser({ ...basePayload, role });
        expect(hasPermission(user!, 'orders', 'delete')).toBe(false);
        expect(hasPlatformPermission(user!, 'integrations', 'update', 'trendyol')).toBe(false);
    });

    it('subUserRole de ayni kati ayristiricidan gecer', () => {
        expect(runCurrentUser({ ...basePayload, role: '1', subUserRole: '2' })!.subUserRole).toBe(UserRole.SubUser);
        expect(runCurrentUser({ ...basePayload, role: '1', subUserRole: '' })!.subUserRole).toBeNaN();
    });
});

describe('hasPermission — alt kullanici modunda izin listesi yoksa RED (fail-closed)', () => {
    const subUserMode = (extra: Partial<UserPayload>): UserPayload => ({
        id: 'parent1', email: 'p@example.com', name: 'S', surname: 'U',
        role: UserRole.User, isSubUserMode: true, subUserId: 'sub1', ...extra
    });

    it('isSubUserMode + permissions YOK → hasPermission false', () => {
        expect(hasPermission(subUserMode({}), 'orders', 'delete')).toBe(false);
    });

    it('isSubUserMode + permissions YOK → hasPlatformPermission false', () => {
        expect(hasPlatformPermission(subUserMode({}), 'integrations', 'update', 'trendyol')).toBe(false);
    });

    it('isSubUserMode + izin verilmis kaynak → true, verilmemis → false (kontrol)', () => {
        const user = subUserMode({ permissions: [{ resource: 'orders', actions: ['read'] }] });
        expect(hasPermission(user, 'orders', 'read')).toBe(true);
        expect(hasPermission(user, 'orders', 'delete')).toBe(false);
    });
});

describe('createAuditLogEntry — Admin rolu (0) SubUser diye kaydedilmez', () => {
    it('role 0 → userRole Admin', () => {
        const req = {
            currentUser: { id: 'a1', email: 'a@example.com', name: 'A', surname: 'D', role: UserRole.Admin },
            ip: '127.0.0.1',
            get: () => 'jest'
        } as unknown as Request;
        expect(createAuditLogEntry(req, 'svc', 'op', 'res').userRole).toBe(UserRole.Admin);
    });

    it('rol yok → SubUser (en dusuk) etiketi korunur (kontrol)', () => {
        const req = {
            currentUser: { id: 'x', email: 'x@example.com', name: 'X', surname: 'Y', role: NaN },
            ip: '127.0.0.1',
            get: () => 'jest'
        } as unknown as Request;
        expect(createAuditLogEntry(req, 'svc', 'op', 'res').userRole).toBe(UserRole.SubUser);
    });
});

/**
 * Rol kapilari `currentUser` normalizasyonuna GUVENMEZ: `req.currentUser`
 * baska bir yoldan (test yardimcisi, ileride eklenen bir ara katman) ham
 * degerle doldurulursa da ayni kati ayristirici uygulanir.
 */
describe('rol kapilari ham (normalize edilmemis) rolde de kati', () => {
    const rawUser = (role: unknown, extra: Record<string, unknown> = {}) =>
        ({ id: 'u1', email: 'u1@example.com', name: 'U', surname: 'One', role, ...extra }) as unknown as UserPayload;

    it('hasPermission / hasPlatformPermission: ham bozuk rol tam yetki ALMAZ', () => {
        expect(hasPermission(rawUser(true), 'orders', 'delete')).toBe(false);
        expect(hasPlatformPermission(rawUser('1e0'), 'integrations', 'update', 'trendyol')).toBe(false);
    });

    it('hasPermission: ham "1" → tam yetki (kontrol)', () => {
        expect(hasPermission(rawUser('1'), 'orders', 'delete')).toBe(true);
    });

    it('isSubUser: ham bozuk rol ("2.0") alt kullanici SAYILMAZ → parent verisine yonlenmez', () => {
        const user = rawUser('2.0', { parentUser: 'parent1' });
        expect(isSubUser(user)).toBe(false);
        expect(getEffectiveUserId(user)).toBe('u1');
    });

    it('isSubUser: ham "2" → alt kullanici, parent verisi (kontrol)', () => {
        const user = rawUser('2', { parentUser: 'parent1' });
        expect(isSubUser(user)).toBe(true);
        expect(getEffectiveUserId(user)).toBe('parent1');
    });

    it('requireAuthAdmin: ham bos string rol → red', () => {
        expect(adminGatePasses(rawUser(''))).toBe(false);
    });

    it('requireAuthAdmin: ham "0" → gecer (kontrol)', () => {
        expect(adminGatePasses(rawUser('0'))).toBe(true);
    });

    it('requireOnboarding: ham bos string rol admin muafiyeti ALMAZ', () => {
        const req = { currentUser: rawUser('', { onboardingCompleted: false }) } as unknown as Request;
        expect(() => requireOnboarding(req, {} as Response, jest.fn() as NextFunction)).toThrow();
    });

    it('requireOnboarding: ham "2" → SubUser muafiyeti (kontrol)', () => {
        const next = jest.fn();
        const req = { currentUser: rawUser('2', { onboardingCompleted: false }) } as unknown as Request;
        requireOnboarding(req, {} as Response, next as unknown as NextFunction);
        expect(next).toHaveBeenCalled();
    });

    it('requireActiveSubscription: ham bos string rol admin muafiyeti ALMAZ, suresi dolmus abonelik reddedilir', async () => {
        mockRedisGet.mockResolvedValueOnce(JSON.stringify({ status: 'expired' }));
        const req = { currentUser: rawUser(''), method: 'POST' } as unknown as Request;
        await expect(requireActiveSubscription()(req, {} as Response, jest.fn() as NextFunction)).rejects.toThrow();
        expect(mockRedisGet).toHaveBeenCalledWith('sub:status:u1');
    });

    it('requireActiveSubscription: ham "0" → admin muaf, Redis sorulmaz (kontrol)', async () => {
        mockRedisGet.mockClear();
        const next = jest.fn();
        const req = { currentUser: rawUser('0'), method: 'POST' } as unknown as Request;
        await requireActiveSubscription()(req, {} as Response, next as unknown as NextFunction);
        expect(next).toHaveBeenCalled();
        expect(mockRedisGet).not.toHaveBeenCalled();
    });
});
