import { Request, Response, NextFunction } from 'express';
import { subUserContext } from '../common/middlewares/sub-user-context';
import { getEffectiveUserId, UserPayload } from '../common/middlewares/current-user';
import { UserRole } from '../common/types/user-role';

const mockRequest = (currentUser: any, headers: Record<string, string> = {}): Partial<Request> => ({
    currentUser,
    headers
});

const mockResponse = (): Partial<Response> => ({});
const mockNext = jest.fn() as NextFunction;

beforeEach(() => {
    jest.clearAllMocks();
});

describe('subUserContext middleware — issue #653 (capraz-tenant IDOR)', () => {
    const attackerId = 'attacker-id';
    const victimId = 'victim-id';

    it('sahte X-Effective-User-Id/X-Actual-User-Id headerlari YOK SAYAR, req.currentUser.id kullanilir', () => {
        const req = mockRequest(
            { id: attackerId, email: 'attacker@test.com', role: UserRole.User },
            { 'x-effective-user-id': victimId, 'x-actual-user-id': victimId }
        ) as Request;
        const res = mockResponse() as Response;

        subUserContext(req, res, mockNext);

        expect((req as any).effectiveUserId).toBe(attackerId);
        expect((req as any).actualUserId).toBe(attackerId);
        expect((req as any).effectiveUserId).not.toBe(victimId);
        expect(mockNext).toHaveBeenCalled();
    });

    it('header hic gonderilmese de normal kullanicida davranis degismez', () => {
        const req = mockRequest(
            { id: attackerId, email: 'attacker@test.com', role: UserRole.User }
        ) as Request;
        const res = mockResponse() as Response;

        subUserContext(req, res, mockNext);

        expect((req as any).effectiveUserId).toBe(attackerId);
        expect((req as any).actualUserId).toBe(attackerId);
    });

    it('normal SubUser giris akisinda (isSubUserMode) effectiveUserId JWT.id (parent) olur, header etkisiz', () => {
        // buildLoginJwtPayload SubUser dalinda JWT.id zaten parent'in id'sidir,
        // parentUser alani JWT'ye yazilmaz.
        const req = mockRequest(
            { id: 'parent-id', email: 'sub@test.com', role: UserRole.User, isSubUserMode: true, subUserId: 'sub-id' },
            { 'x-effective-user-id': victimId, 'x-actual-user-id': victimId }
        ) as Request;
        const res = mockResponse() as Response;

        subUserContext(req, res, mockNext);

        expect((req as any).effectiveUserId).toBe('parent-id');
    });

    it('currentUser yoksa context alanlari eklenmez ve next cagrilir', () => {
        const req = mockRequest(undefined, { 'x-effective-user-id': victimId }) as Request;
        const res = mockResponse() as Response;

        subUserContext(req, res, mockNext);

        expect((req as any).effectiveUserId).toBeUndefined();
        expect(mockNext).toHaveBeenCalled();
    });
});

describe('getEffectiveUserId — admin taklit kenar durumu (issue #653)', () => {
    it('admin bir alt kullaniciyi taklit ederken (isSubUserMode YOK, role=SubUser) parentUser doner', () => {
        // impersonateUser.ts'in urettigi JWT: id = taklit edilenin kendi id'si,
        // parentUser = gercek parent, role = SubUser, isSubUserMode YAZILMAZ.
        const impersonatedSubUser: UserPayload = {
            id: 'subuser-own-id',
            email: 'sub@test.com',
            name: 'Sub',
            surname: 'User',
            parentUser: 'real-parent-id',
            role: UserRole.SubUser,
            adminId: 'admin-id',
            isImpersonating: true
        };

        expect(getEffectiveUserId(impersonatedSubUser)).toBe('real-parent-id');
    });

    it('normal SubUser girisinde (isSubUserMode true) JWT.id zaten parent oldugu icin degismez', () => {
        const subUserPayload: UserPayload = {
            id: 'parent-id',
            email: 'sub@test.com',
            name: 'Sub',
            surname: 'User',
            role: UserRole.User,
            isSubUserMode: true,
            subUserId: 'sub-id'
        };

        expect(getEffectiveUserId(subUserPayload)).toBe('parent-id');
    });

    it('normal kullanicida kendi id\'sini doner', () => {
        const normalUser: UserPayload = {
            id: 'user-id',
            email: 'user@test.com',
            name: 'User',
            surname: 'Test',
            role: UserRole.User
        };

        expect(getEffectiveUserId(normalUser)).toBe('user-id');
    });

    it('admin normal bir kullaniciyi taklit ederken (role != SubUser) taklit edilenin kendi id\'sini doner', () => {
        const impersonatedRegularUser: UserPayload = {
            id: 'regular-user-id',
            email: 'regular@test.com',
            name: 'Regular',
            surname: 'User',
            parentUser: undefined,
            role: UserRole.User,
            adminId: 'admin-id',
            isImpersonating: true
        };

        expect(getEffectiveUserId(impersonatedRegularUser)).toBe('regular-user-id');
    });
});
