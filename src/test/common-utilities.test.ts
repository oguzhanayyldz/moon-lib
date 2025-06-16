import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock jsonwebtoken before importing modules
jest.mock('jsonwebtoken', () => ({
    verify: jest.fn()
}));

import {
    BadRequestError,
    NotFoundError,
    CustomError,
    NotAuthorizedError,
    DatabaseConnectionError,
    RequestValidationError
} from '../index'; // Import from main index
import { currentUser, requireAuth, errorHandler } from '../index';
import { UserRole } from '../index';

describe('Moon-lib Complete Common Utilities', () => {
    describe('BadRequestError', () => {
        it('should create BadRequestError with correct status code', () => {
            const error = new BadRequestError('Invalid input');

            expect(error).toBeInstanceOf(CustomError);
            expect(error.statusCode).toBe(400);
            expect(error.message).toBe('Invalid input');
        });

        it('should serialize errors correctly', () => {
            const error = new BadRequestError('Test error message');
            const serialized = error.serializeErrors();

            expect(serialized).toEqual([{ message: 'Test error message' }]);
        });
    });

    describe('NotFoundError', () => {
        it('should create NotFoundError with correct status code', () => {
            const error = new NotFoundError();

            expect(error).toBeInstanceOf(CustomError);
            expect(error.statusCode).toBe(404);
            expect(error.message).toBe('Route not found');
        });

        it('should serialize errors correctly', () => {
            const error = new NotFoundError();
            const serialized = error.serializeErrors();

            expect(serialized).toEqual([{ message: 'Not Found' }]);
        });
    });

    describe('NotAuthorizedError', () => {
        it('should create NotAuthorizedError with correct status code', () => {
            const error = new NotAuthorizedError();

            expect(error).toBeInstanceOf(CustomError);
            expect(error.statusCode).toBe(401);
            expect(error.message).toBe('Not authorized');
        });

        it('should serialize errors correctly', () => {
            const error = new NotAuthorizedError();
            const serialized = error.serializeErrors();

            expect(serialized).toEqual([{ message: 'Not authorized' }]);
        });
    });

    describe('DatabaseConnectionError', () => {
        it('should create DatabaseConnectionError with correct status code', () => {
            const error = new DatabaseConnectionError();

            expect(error).toBeInstanceOf(CustomError);
            expect(error.statusCode).toBe(500);
            expect(error.message).toBe('Error connecting to database');
        });

        it('should serialize errors correctly', () => {
            const error = new DatabaseConnectionError();
            const serialized = error.serializeErrors();

            expect(serialized).toEqual([{ message: 'Error connecting to database' }]);
        });
    });

    describe('RequestValidationError', () => {
        it('should create RequestValidationError with field errors', () => {
            const mockErrors = [
                { type: 'field' as const, msg: 'Email is required', path: 'email', location: 'body' as const },
                { type: 'field' as const, msg: 'Password must be at least 6 characters', path: 'password', location: 'body' as const }
            ];

            const error = new RequestValidationError(mockErrors);

            expect(error).toBeInstanceOf(CustomError);
            expect(error.statusCode).toBe(400);
            expect(error.message).toBe('Invalid request parameters');
        });

        it('should serialize field errors correctly', () => {
            const mockErrors = [
                { type: 'field' as const, msg: 'Email is required', path: 'email', location: 'body' as const },
                { type: 'alternative_grouped' as const, msg: 'General validation error', nestedErrors: [] }
            ];

            const error = new RequestValidationError(mockErrors);
            const serialized = error.serializeErrors();

            expect(serialized).toEqual([
                { message: 'Email is required', field: 'email' },
                { message: 'General validation error' }
            ]);
        });
    });

    describe('UserRole Enum', () => {
        it('should have correct role values', () => {
            expect(UserRole.Admin).toBe(0);
            expect(UserRole.User).toBe(1);
            expect(UserRole.SubUser).toBe(2);
        });
    });

    describe('Middleware Integration', () => {
        describe('currentUser middleware', () => {
            it('should extract user from JWT session', () => {
                // Mock JWT verify before using
                const jwt = require('jsonwebtoken');
                const mockPayload = {
                    id: 'user-123',
                    email: 'test@example.com',
                    role: UserRole.User
                };

                (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

                const mockReq = {
                    session: {
                        jwt: 'mock-jwt-token'
                    }
                } as any;
                const mockRes = {} as any;
                const mockNext = jest.fn();

                currentUser(mockReq, mockRes, mockNext);

                expect(mockReq.currentUser).toBeDefined();
                expect(mockReq.currentUser.id).toBe('user-123');
                expect(mockNext).toHaveBeenCalled();
            });

            it('should handle missing session gracefully', () => {
                const mockReq = {} as any;
                const mockRes = {} as any;
                const mockNext = jest.fn();

                currentUser(mockReq, mockRes, mockNext);

                expect(mockReq.currentUser).toBeUndefined();
                expect(mockNext).toHaveBeenCalled();
            });
        });

        describe('requireAuth middleware', () => {
            it('should pass when user is authenticated', () => {
                const mockReq = {
                    currentUser: { id: 'user-123', role: UserRole.User }
                } as any;
                const mockRes = {} as any;
                const mockNext = jest.fn();

                requireAuth(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalled();
            });

            it('should throw NotAuthorizedError when user not authenticated', () => {
                const mockReq = {} as any;
                const mockRes = {} as any;
                const mockNext = jest.fn();

                expect(() => {
                    requireAuth(mockReq, mockRes, mockNext);
                }).toThrow(NotAuthorizedError);
            });
        });

        describe('errorHandler middleware', () => {
            it('should handle custom errors correctly', () => {
                const error = new BadRequestError('Test error');
                const mockReq = {} as any;
                const mockRes = {
                    status: jest.fn().mockReturnThis(),
                    send: jest.fn()
                } as any;
                const mockNext = jest.fn();

                errorHandler(error, mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(400);
                expect(mockRes.send).toHaveBeenCalledWith({
                    errors: [{ message: 'Test error' }]
                });
            });

            it('should handle generic errors with 400 status', () => {
                const error = new Error('Generic error');
                const mockReq = {} as any;
                const mockRes = {
                    status: jest.fn().mockReturnThis(),
                    send: jest.fn()
                } as any;
                const mockNext = jest.fn();

                console.error = jest.fn(); // Mock console.error

                errorHandler(error, mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(400);
                expect(mockRes.send).toHaveBeenCalledWith({
                    errors: [{ message: 'Something went wrong' }]
                });
            });
        });
    });

    // Example usage demonstration
    describe('Moon-lib Usage Examples', () => {
        it('demonstrates how to use error utilities in services', () => {
            const mockService = {
                findUser: (id: string) => {
                    if (!id) {
                        throw new BadRequestError('User ID is required');
                    }
                    if (id === 'invalid') {
                        throw new NotFoundError();
                    }
                    return { id, name: 'Test User' };
                }
            };

            // Test valid usage
            expect(mockService.findUser('123')).toEqual({ id: '123', name: 'Test User' });

            // Test error cases
            expect(() => mockService.findUser('')).toThrow(BadRequestError);
            expect(() => mockService.findUser('invalid')).toThrow(NotFoundError);
        });
    });
});
