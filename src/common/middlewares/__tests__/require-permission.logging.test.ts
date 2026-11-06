import { Request, Response } from 'express';
import { logger } from '../../../services/logger.service';
import { UserRole } from '../../types/user-role';
import { requirePermission } from '../require-permission';

// UC-832: access decisions go through the logger, not console.*; granted requests only at debug level.
const run = (user: Record<string, unknown>) => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
    const next = jest.fn();
    requirePermission('orders', 'read')({ currentUser: user } as unknown as Request, res, next);
    return { res, next };
};

describe('requirePermission logging (UC-832)', () => {
    let consoleSpies: jest.SpyInstance[];
    let warnSpy: jest.SpyInstance;
    let debugSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleSpies = (['log', 'warn', 'error', 'info'] as const).map((method) =>
            jest.spyOn(console, method).mockImplementation(() => undefined)
        );
        warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => logger);
        debugSpy = jest.spyOn(logger, 'debug').mockImplementation(() => logger);
    });

    afterEach(() => jest.restoreAllMocks());

    it('logs a denial with logger.warn', () => {
        const { res, next } = run({ id: 'u1', role: UserRole.Admin, isSubUserMode: true, permissions: [] });

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Permission denied: User u1'));
        consoleSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    });

    it('logs a granted request with logger.debug', () => {
        const { next } = run({ id: 'u1', role: UserRole.Admin });

        expect(next).toHaveBeenCalled();
        expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Permission granted: User u1'));
        consoleSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    });
});
