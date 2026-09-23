import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

jest.mock('../services/redisWrapper.service', () => ({
    redisWrapper: { client: undefined }
}));

import { requireAuthAdmin } from '../common/middlewares/require-auth-admin';
import { requirePlatformPermission } from '../common/middlewares/require-platform-permission';
import { currentUser, hasPlatformPermission, UserPayload } from '../common/middlewares/current-user';
import { NotAuthorizedError } from '../common/errors/not-authorized-error';
import { UserRole } from '../common/types/user-role';

const user = (overrides: Partial<UserPayload>): UserPayload => ({
    id: 'owner-id',
    email: 'owner@test.local',
    name: 'Test',
    surname: 'User',
    role: UserRole.User,
    ...overrides
});

const runAdminGate = (currentUserPayload?: UserPayload) => {
    const req = { currentUser: currentUserPayload } as Request;
    const next = jest.fn() as NextFunction;
    let error: unknown;
    try {
        requireAuthAdmin(req, {} as Response, next);
    } catch (err) {
        error = err;
    }
    return { next, error };
};

describe('requireAuthAdmin', () => {
    it('gercek platform yoneticisi gecer', () => {
        const { next, error } = runAdminGate(user({ role: UserRole.Admin }));
        expect(error).toBeUndefined();
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('oturum yoksa reddeder', () => {
        const { next, error } = runAdminGate(undefined);
        expect(error).toBeInstanceOf(NotAuthorizedError);
        expect(next).not.toHaveBeenCalled();
    });

    it('Admin hesabinin alt kullanicisini reddeder (role hesap sahibinin rolu)', () => {
        const { next, error } = runAdminGate(user({
            role: UserRole.Admin,
            isSubUserMode: true,
            subUserId: 'sub-id',
            subUserRole: UserRole.SubUser,
            permissions: [{ resource: 'integrations', actions: ['*'] }]
        }));
        expect(error).toBeInstanceOf(NotAuthorizedError);
        expect(next).not.toHaveBeenCalled();
    });

    it('normal kullaniciyi reddeder', () => {
        const { next, error } = runAdminGate(user({ role: UserRole.User }));
        expect(error).toBeInstanceOf(NotAuthorizedError);
        expect(next).not.toHaveBeenCalled();
    });

    it('normal kullanicinin alt kullanicisini reddeder', () => {
        const { next, error } = runAdminGate(user({ role: UserRole.User, isSubUserMode: true }));
        expect(error).toBeInstanceOf(NotAuthorizedError);
        expect(next).not.toHaveBeenCalled();
    });

    it('dogrudan SubUser rolunu reddeder (parentUser bos kenar durumu)', () => {
        const { next, error } = runAdminGate(user({ role: UserRole.SubUser }));
        expect(error).toBeInstanceOf(NotAuthorizedError);
        expect(next).not.toHaveBeenCalled();
    });

    describe('admin taklidi (impersonateUser.ts JWT sekli)', () => {
        const impersonation = (role: UserRole) => user({
            id: 'target-id',
            role,
            adminId: 'admin-id',
            isImpersonating: true
        });

        it('taklit edilen hesap Admin ise gecer (taklit bayragi tek basina reddetmez)', () => {
            const { next, error } = runAdminGate(impersonation(UserRole.Admin));
            expect(error).toBeUndefined();
            expect(next).toHaveBeenCalledTimes(1);
        });

        it('taklit edilen hesap normal kullanici ise reddeder (degisiklik oncesiyle ayni)', () => {
            const { next, error } = runAdminGate(impersonation(UserRole.User));
            expect(error).toBeInstanceOf(NotAuthorizedError);
            expect(next).not.toHaveBeenCalled();
        });

        it('taklit edilen hesap alt kullanici ise reddeder (degisiklik oncesiyle ayni)', () => {
            const { next, error } = runAdminGate(impersonation(UserRole.SubUser));
            expect(error).toBeInstanceOf(NotAuthorizedError);
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('imzali JWT -> currentUser -> requireAuthAdmin (uctan uca)', () => {
        const JWT_KEY = 'test-jwt-key';
        const originalKey = process.env.JWT_KEY;

        beforeAll(() => { process.env.JWT_KEY = JWT_KEY; });
        afterAll(() => { process.env.JWT_KEY = originalKey; });

        // Rol JWT'de STRING tasiniyor (sema `role: String`), currentUser normalize eder.
        const runChain = (payload: object) => {
            const req = { session: { jwt: jwt.sign(payload, JWT_KEY) } } as unknown as Request;
            currentUser(req, {} as Response, () => undefined);
            return runAdminGate(req.currentUser);
        };

        it('buildLoginJwtPayload alt kullanici dali (Admin ebeveyn) reddedilir', () => {
            const { next, error } = runChain({
                id: 'admin-id',
                email: 'admin@test.local',
                name: 'Sub',
                surname: 'User',
                role: '0',
                isSubUserMode: true,
                subUserId: 'sub-id',
                subUserEmail: 'sub@test.local',
                subUserRole: '2',
                permissions: []
            });
            expect(error).toBeInstanceOf(NotAuthorizedError);
            expect(next).not.toHaveBeenCalled();
        });

        it('buildLoginJwtPayload normal dali (Admin) gecer', () => {
            const { next, error } = runChain({
                id: 'admin-id',
                email: 'admin@test.local',
                name: 'Admin',
                surname: 'User',
                role: '0',
                permissions: []
            });
            expect(error).toBeUndefined();
            expect(next).toHaveBeenCalledTimes(1);
        });
    });
});

describe('requirePlatformPermission', () => {
    const runPlatformGate = (
        currentUserPayload: UserPayload,
        platform: string | undefined,
        action = 'read',
        options?: { allowNoConstraints?: boolean }
    ) => {
        const status = jest.fn().mockReturnThis();
        const json = jest.fn().mockReturnThis();
        const res = { status, json } as unknown as Response;
        const next = jest.fn() as NextFunction;
        const middleware = requirePlatformPermission('integrations', action, () => platform, { logAccess: false, ...options });
        middleware({ currentUser: currentUserPayload } as Request, res, next);
        return { next, status };
    };

    const subUser = (actions: string[], platforms?: string[]) => user({
        isSubUserMode: true,
        permissions: [{
            resource: 'integrations',
            actions,
            ...(platforms ? { constraints: { platforms } } : {})
        }]
    });

    it("'*' eylem + platform kisiti: izinsiz platformda 403 (eski fail-open)", () => {
        const { next, status } = runPlatformGate(subUser(['*'], ['amazon']), 'trendyol');
        expect(status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    it("'*' eylem + platform kisiti: izinli platformda gecer", () => {
        const { next, status } = runPlatformGate(subUser(['*'], ['amazon']), 'amazon');
        expect(status).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('acik eylem + platform kisiti: izinsiz platformda 403', () => {
        const { next, status } = runPlatformGate(subUser(['read'], ['amazon']), 'trendyol');
        expect(status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('kisitsiz izin: allowNoConstraints=false ise 403, varsayilanda gecer', () => {
        expect(runPlatformGate(subUser(['read']), 'trendyol', 'read', { allowNoConstraints: false }).status)
            .toHaveBeenCalledWith(403);
        expect(runPlatformGate(subUser(['read']), 'trendyol').next).toHaveBeenCalledTimes(1);
    });

    it('kisitli izin + allowNoConstraints=false: izinli platformda gecer', () => {
        const { next } = runPlatformGate(subUser(['read'], ['amazon']), 'amazon', 'read', { allowNoConstraints: false });
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('izni olmayan alt kullanici 403 alir', () => {
        const { next, status } = runPlatformGate(user({ isSubUserMode: true, permissions: [] }), 'amazon');
        expect(status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('hesap sahibi (alt kullanici degil) her platformda gecer', () => {
        const { next } = runPlatformGate(user({ role: UserRole.User }), 'trendyol');
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('karar hasPlatformPermission ile birebir ayni (matris)', () => {
        const users = [
            user({ role: UserRole.User }),
            user({ role: UserRole.Admin }),
            subUser(['*'], ['amazon']),
            subUser(['*']),
            subUser(['read'], ['amazon']),
            subUser(['update'], ['trendyol']),
            user({ isSubUserMode: true, permissions: [] }),
            user({ role: UserRole.SubUser, permissions: [{ resource: 'integrations', actions: ['*'], constraints: { platforms: ['n11'] } }] })
        ];
        for (const u of users) {
            for (const action of ['read', 'update']) {
                for (const platform of ['amazon', 'trendyol', 'n11']) {
                    const { next } = runPlatformGate(u, platform, action);
                    const allowed = (next as jest.Mock).mock.calls.length === 1;
                    expect({ u: u.permissions, action, platform, allowed })
                        .toEqual({ u: u.permissions, action, platform, allowed: hasPlatformPermission(u, 'integrations', action, platform) });
                }
            }
        }
    });
});
