import { describe, it, expect } from '@jest/globals';
import { BadRequestError } from '../common/errors/bad-request-error';
import { NotFoundError } from '../common/errors/not-found-error';
import { CustomError } from '../common/errors/custom-error';

describe('Moon-lib Common Error Utilities', () => {
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
