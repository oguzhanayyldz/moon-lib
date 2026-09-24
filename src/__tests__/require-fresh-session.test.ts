import { Request, Response, NextFunction } from 'express';
import {
    requireFreshSession,
    startedBeforeRevocation,
    tokenSessionStartedAt,
    SessionRevocationLookup
} from '../common/middlewares/require-fresh-session';
import { NotAuthorizedError } from '../common/errors/not-authorized-error';
import { UserRole } from '../common/types/user-role';

const REVOKED_AT = new Date('2026-09-24T12:00:00.000Z');
const BEFORE = REVOKED_AT.getTime() - 60_000;
const AFTER = REVOKED_AT.getTime() + 60_000;

const run = async (currentUser: any, lookup: SessionRevocationLookup) => {
    const req = { currentUser } as Request;
    const next = jest.fn() as jest.MockedFunction<NextFunction>;
    await requireFreshSession(lookup)(req, {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    return next.mock.calls[0][0];
};

const owner = (claims: Record<string, unknown>) => ({
    id: 'owner-1',
    email: 'o@example.com',
    name: 'O',
    surname: 'O',
    role: UserRole.User,
    ...claims
});

describe('tokenSessionStartedAt', () => {
    it('sst varsa onu dondurur (iat yok sayilir)', () => {
        expect(tokenSessionStartedAt({ sst: 1000, iat: 5 })).toBe(1000);
    });

    it('sst yoksa iat saniyesinin SON milisaniyesi', () => {
        expect(tokenSessionStartedAt({ iat: 1700000000 })).toBe(1700000000999);
    });

    it('ikisi de yoksa undefined', () => {
        expect(tokenSessionStartedAt({})).toBeUndefined();
    });

    it('sayi olmayan sst yok sayilir', () => {
        expect(tokenSessionStartedAt({ sst: '1000', iat: 1 })).toBe(1999);
    });
});

describe('startedBeforeRevocation', () => {
    it('damga yoksa false', () => {
        expect(startedBeforeRevocation(undefined, BEFORE)).toBe(false);
        expect(startedBeforeRevocation(null, BEFORE)).toBe(false);
    });

    it('damgadan once baslamis oturum true', () => {
        expect(startedBeforeRevocation(REVOKED_AT, BEFORE)).toBe(true);
    });

    it('damgadan sonra baslamis oturum false', () => {
        expect(startedBeforeRevocation(REVOKED_AT, AFTER)).toBe(false);
    });

    it('ayni milisaniye gecer (<)', () => {
        expect(startedBeforeRevocation(REVOKED_AT, REVOKED_AT.getTime())).toBe(false);
    });
});

describe('requireFreshSession', () => {
    it('currentUser yoksa lookup cagirmadan gecer', async () => {
        const lookup = jest.fn();
        expect(await run(undefined, lookup)).toBeUndefined();
        expect(lookup).not.toHaveBeenCalled();
    });

    it('iptalden once baslamis oturum → NotAuthorizedError', async () => {
        const lookup = jest.fn().mockResolvedValue({ sessionsRevokedAt: REVOKED_AT });
        const err = await run(owner({ sst: BEFORE }), lookup);
        expect(err).toBeInstanceOf(NotAuthorizedError);
        expect(lookup).toHaveBeenCalledWith('owner-1');
    });

    it('iptalden sonra baslamis oturum gecer', async () => {
        const lookup = jest.fn().mockResolvedValue({ sessionsRevokedAt: REVOKED_AT });
        expect(await run(owner({ sst: AFTER }), lookup)).toBeUndefined();
    });

    it('kopya yoksa gecer (lead karari 1)', async () => {
        const lookup = jest.fn().mockResolvedValue(null);
        expect(await run(owner({ sst: BEFORE }), lookup)).toBeUndefined();
    });

    it('lookup hatasi → fail-closed, hata iletilir', async () => {
        const boom = new Error('mongo down');
        const lookup = jest.fn().mockRejectedValue(boom);
        expect(await run(owner({ sst: AFTER }), lookup)).toBe(boom);
    });

    it('sst yoksa iat yedegi kullanilir', async () => {
        const lookup = jest.fn().mockResolvedValue({ sessionsRevokedAt: REVOKED_AT });
        const err = await run(owner({ iat: Math.floor(BEFORE / 1000) }), lookup);
        expect(err).toBeInstanceOf(NotAuthorizedError);
    });

    it('baslangic bilinmiyorsa (sst/iat yok) esigi olan hesapta red', async () => {
        const lookup = jest.fn().mockResolvedValue({ sessionsRevokedAt: REVOKED_AT });
        expect(await run(owner({}), lookup)).toBeInstanceOf(NotAuthorizedError);
    });

    it('taklitte esik ADMININ damgasi — hedefin id\'si sorulmaz', async () => {
        const lookup = jest.fn().mockResolvedValue({ sessionsRevokedAt: REVOKED_AT });
        const err = await run(owner({ sst: BEFORE, isImpersonating: true, adminId: 'admin-9' }), lookup);
        expect(err).toBeInstanceOf(NotAuthorizedError);
        expect(lookup).toHaveBeenCalledWith('admin-9');
        expect(lookup).not.toHaveBeenCalledWith('owner-1');
    });

    it('taklitte adminId yoksa red, lookup cagrilmaz', async () => {
        const lookup = jest.fn();
        const err = await run(owner({ sst: AFTER, isImpersonating: true }), lookup);
        expect(err).toBeInstanceOf(NotAuthorizedError);
        expect(lookup).not.toHaveBeenCalled();
    });

    it('alt kullanici oturumunda esik alt kullanicinin KENDI id\'si', async () => {
        const lookup = jest.fn().mockResolvedValue(null);
        await run(owner({ sst: AFTER, isSubUserMode: true, subUserId: 'sub-3' }), lookup);
        expect(lookup).toHaveBeenCalledWith('sub-3');
    });
});
