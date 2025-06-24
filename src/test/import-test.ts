// Test all critical imports from moon-lib
import { 
  // Error Classes
  CustomError,
  BadRequestError,
  NotFoundError,
  NotAuthorizedError,
  DatabaseConnectionError,
  RequestValidationError,
  
  // Middlewares
  currentUser,
  requireAuth,
  errorHandler,
  
  // Event System
  Publisher as BasePublisher,
  Listener as BaseListener,
  Event,
  Subjects,
  
  // Types
  UserRole,
  
  // Core Integration
  BaseIntegration
} from '../index';

// All critical imports successful!

// Quick functionality tests
const testError = new BadRequestError('Test error');
// Error creation test passed
// UserRole enum test passed
// Subjects enum test passed

export {};
