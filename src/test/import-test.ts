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

console.log('✅ All critical imports successful!');

// Quick functionality tests
const testError = new BadRequestError('Test error');
console.log('✅ Error creation works:', testError.statusCode === 400);

console.log('✅ UserRole enum works:', UserRole.Admin === 0);

console.log('✅ Subjects enum works:', typeof Subjects.UserCreated === 'string');

export {};
