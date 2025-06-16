// Example service usage of moon-lib common utilities
import { 
  BadRequestError, 
  NotFoundError,
  currentUser,
  requireAuth,
  errorHandler,
  Publisher,
  Subjects,
  UserRole 
} from '@xmoonx/moon-lib';

// Example Express route using moon-lib utilities
class ExampleService {
  
  // Using error classes
  validateUser(id: string) {
    if (!id) {
      throw new BadRequestError('User ID is required');
    }
    
    if (id === 'invalid') {
      throw new NotFoundError();
    }
    
    return { id, role: UserRole.User };
  }
  
  // Using event publisher
  async publishUserEvent(userData: any) {
    // This would work with proper NATS client
    console.log('Publishing user event:', userData);
  }
}

// Example Express app setup
const setupApp = () => {
  // app.use(currentUser);      // ✅ JWT middleware
  // app.use(requireAuth);      // ✅ Auth requirement
  // app.use(errorHandler);     // ✅ Error handling
  console.log('✅ All middlewares available');
};

export { ExampleService, setupApp };
