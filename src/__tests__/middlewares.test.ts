import { Request, Response, NextFunction } from 'express';

// Mock redisWrapper for require-active-subscription
jest.mock('../services/redisWrapper.service', () => ({
    redisWrapper: {
        client: {
            get: jest.fn(),
            set: jest.fn(),
        }
    }
}));

import { requireEmailVerified } from '../common/middlewares/require-email-verified';
import { requireOnboarding } from '../common/middlewares/require-onboarding';
import { requireActiveSubscription } from '../common/middlewares/require-active-subscription';
import { UserRole } from '../common/types/user-role';

const mockRequest = (currentUser?: any): Partial<Request> => ({
    currentUser,
    method: 'POST'
});

const mockResponse = (): Partial<Response> => ({});

const mockNext = jest.fn() as NextFunction;

beforeEach(() => {
    jest.clearAllMocks();
});

describe('requireEmailVerified Middleware', () => {
    it('should throw NotAuthorizedError when no currentUser', () => {
        const req = mockRequest(undefined) as Request;
        const res = mockResponse() as Response;

        expect(() => {
            requireEmailVerified(req, res, mockNext);
        }).toThrow();
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw when emailVerified is explicitly false', () => {
        const req = mockRequest({ emailVerified: false }) as Request;
        const res = mockResponse() as Response;

        expect(() => {
            requireEmailVerified(req, res, mockNext);
        }).toThrow('EMAIL_NOT_VERIFIED');
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass when emailVerified is true', () => {
        const req = mockRequest({ emailVerified: true }) as Request;
        const res = mockResponse() as Response;

        requireEmailVerified(req, res, mockNext);
        expect(mockNext).toHaveBeenCalled();
    });

    it('should pass when emailVerified is undefined (backward compat)', () => {
        const req = mockRequest({ id: 'user123' }) as Request;
        const res = mockResponse() as Response;

        requireEmailVerified(req, res, mockNext);
        expect(mockNext).toHaveBeenCalled();
    });

    it('should pass when emailVerified is null (backward compat)', () => {
        const req = mockRequest({ emailVerified: null }) as Request;
        const res = mockResponse() as Response;

        requireEmailVerified(req, res, mockNext);
        expect(mockNext).toHaveBeenCalled();
    });
});

describe('requireOnboarding Middleware', () => {
    it('should throw NotAuthorizedError when no currentUser', () => {
        const req = mockRequest(undefined) as Request;
        const res = mockResponse() as Response;

        expect(() => {
            requireOnboarding(req, res, mockNext);
        }).toThrow();
    });

    it('should throw when onboardingCompleted is false', () => {
        const req = mockRequest({ role: UserRole.User, onboardingCompleted: false }) as Request;
        const res = mockResponse() as Response;

        expect(() => {
            requireOnboarding(req, res, mockNext);
        }).toThrow('ONBOARDING_REQUIRED');
    });

    it('should pass when onboardingCompleted is true', () => {
        const req = mockRequest({ role: UserRole.User, onboardingCompleted: true }) as Request;
        const res = mockResponse() as Response;

        requireOnboarding(req, res, mockNext);
        expect(mockNext).toHaveBeenCalled();
    });

    it('should pass when onboardingCompleted is undefined (backward compat)', () => {
        const req = mockRequest({ role: UserRole.User }) as Request;
        const res = mockResponse() as Response;

        requireOnboarding(req, res, mockNext);
        expect(mockNext).toHaveBeenCalled();
    });

    it('should skip check for Admin users', () => {
        const req = mockRequest({ role: UserRole.Admin, onboardingCompleted: false }) as Request;
        const res = mockResponse() as Response;

        requireOnboarding(req, res, mockNext);
        expect(mockNext).toHaveBeenCalled();
    });

    it('should skip check for SubUser role', () => {
        const req = mockRequest({ role: UserRole.SubUser, onboardingCompleted: false }) as Request;
        const res = mockResponse() as Response;

        requireOnboarding(req, res, mockNext);
        expect(mockNext).toHaveBeenCalled();
    });

    it('should skip check for SubUser mode', () => {
        const req = mockRequest({ role: UserRole.User, isSubUserMode: true, onboardingCompleted: false }) as Request;
        const res = mockResponse() as Response;

        requireOnboarding(req, res, mockNext);
        expect(mockNext).toHaveBeenCalled();
    });
});

describe('requireActiveSubscription Middleware', () => {
    it('should throw NotAuthorizedError when no currentUser', async () => {
        const middleware = requireActiveSubscription();
        const req = mockRequest(undefined) as Request;
        const res = mockResponse() as Response;

        await expect(async () => {
            await middleware(req, res, mockNext);
        }).rejects.toThrow();
    });

    it('should skip check for Admin users', async () => {
        const middleware = requireActiveSubscription();
        const req = mockRequest({ id: 'admin1', role: UserRole.Admin }) as Request;
        const res = mockResponse() as Response;

        await middleware(req, res, mockNext);
        expect(mockNext).toHaveBeenCalled();
    });

    it('should skip check for SubUser mode', async () => {
        const middleware = requireActiveSubscription();
        const req = mockRequest({ id: 'user1', role: UserRole.User, isSubUserMode: true }) as Request;
        const res = mockResponse() as Response;

        await middleware(req, res, mockNext);
        expect(mockNext).toHaveBeenCalled();
    });

    it('should allow GET requests when allowRead is true', async () => {
        const middleware = requireActiveSubscription({ allowRead: true });
        const req = { ...mockRequest({ id: 'user1', role: UserRole.User }), method: 'GET' } as Request;
        const res = mockResponse() as Response;

        await middleware(req, res, mockNext);
        expect(mockNext).toHaveBeenCalled();
    });

    it('should gracefully degrade when Redis is unavailable', async () => {
        const { redisWrapper } = require('../services/redisWrapper.service');
        redisWrapper.client.get.mockRejectedValue(new Error('Redis connection failed'));

        const middleware = requireActiveSubscription();
        const req = mockRequest({ id: 'user1', role: UserRole.User }) as Request;
        const res = mockResponse() as Response;

        await middleware(req, res, mockNext);
        expect(mockNext).toHaveBeenCalled();
    });
});
