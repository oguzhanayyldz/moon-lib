# Security Modules

The `@xmoonx/moon-lib` security modules provide comprehensive security features for microservices in the Moon Project. These modules are designed for dependency injection and can be easily integrated into any microservice.

## Overview

The security system consists of five main modules:

- **SecurityValidator**: Input validation, XSS protection, SQL injection prevention, and file upload validation
- **RateLimiter**: Request rate limiting with Redis-based storage
- **BruteForceProtection**: Protection against brute force attacks
- **SecurityHeaders**: HTTP security headers management
- **SecurityManager**: Centralized security management and orchestration

## Design Principles

### Dependency Injection

All security modules follow the dependency injection pattern. They don't create their own dependencies but accept them through constructors:

```typescript
// ✅ Correct: Pass dependencies to constructor
const rateLimiter = new RateLimiter(redisWrapper.client, config);
const bruteForceProtection = new BruteForceProtection(redisWrapper.client, config);

// ❌ Incorrect: Modules don't have global singletons
// rateLimiter.getInstance() // This doesn't exist
```

### Service-Specific Configuration

Each microservice should create its own security service that configures the modules according to its specific needs:

```typescript
// auth/src/services/security.service.ts
class AuthSecurityService {
    constructor() {
        this.rateLimiter = new RateLimiter(redisWrapper.client, {
            windowMs: 15 * 60 * 1000,
            maxRequests: 100, // Stricter for auth
            keyGenerator: (req) => `auth_rate_limit:${req.ip}`
        });
    }
}

// orders/src/services/security.service.ts  
class OrdersSecurityService {
    constructor() {
        this.rateLimiter = new RateLimiter(redisWrapper.client, {
            windowMs: 15 * 60 * 1000,
            maxRequests: 200, // More lenient for orders
            keyGenerator: (req) => `orders_rate_limit:${req.currentUser?.id || req.ip}`
        });
    }
}
```

## Usage Examples

### 1. SecurityValidator

```typescript
import { SecurityValidator } from '@xmoonx/moon-lib';

const validator = new SecurityValidator({
    enableInputSanitization: true,
    maxInputLength: 1000,
    enableXSSProtection: true,
    enableSQLInjectionProtection: true,
    enableFileUploadValidation: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedFileTypes: ['image/jpeg', 'image/png', 'application/pdf']
});

// Validate input data
const result = validator.validateInput(req.body);
if (!result.isValid) {
    return res.status(400).json({ errors: result.errors });
}

// Validate file uploads
const fileResult = validator.validateFileUpload({
    file: req.file,
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png']
});
```

### 2. RateLimiter

```typescript
import { RateLimiter, redisWrapper } from '@xmoonx/moon-lib';

const rateLimiter = new RateLimiter(redisWrapper.client, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    keyGenerator: (req) => `api_rate_limit:${req.ip}`,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
});

// Use as Express middleware
app.use('/api/auth', rateLimiter.middleware());
```

### 3. BruteForceProtection

```typescript
import { BruteForceProtection, redisWrapper } from '@xmoonx/moon-lib';

const bruteForceProtection = new BruteForceProtection(redisWrapper.client, {
    maxAttempts: 5,
    blockDurationMs: 15 * 60 * 1000, // 15 minutes
    windowMs: 60 * 60 * 1000, // 1 hour
    enabled: true
});

// Use for login protection
app.use('/api/auth/login', bruteForceProtection.loginProtection());

// Manual usage
const isBlocked = await bruteForceProtection.isBlocked(userEmail);
const status = await bruteForceProtection.getStatus(userEmail);
await bruteForceProtection.recordFailedAttempt(userEmail);
```

### 4. SecurityHeaders

```typescript
import { SecurityHeaders } from '@xmoonx/moon-lib';

const securityHeaders = new SecurityHeaders({
    enableCSP: true,
    enableHSTS: true,
    enableXFrameOptions: true,
    enableXContentTypeOptions: true,
    enableXSSProtection: true,
    csp: {
        directives: {
            'default-src': ["'self'"],
            'script-src': ["'self'"],
            'style-src': ["'self'", "'unsafe-inline'"]
        }
    }
});

// Use as Express middleware (should be first middleware)
app.use(securityHeaders.middleware());
```

### 5. SecurityManager

```typescript
import { SecurityManager } from '@xmoonx/moon-lib';

const securityManager = new SecurityManager({
    enableInputValidation: true,
    enableRateLimit: true,
    enableBruteForceProtection: true,
    enableSecurityHeaders: true,
    enableFileUploadValidation: true
});

// The SecurityManager provides unified configuration and management
```

## Integration Pattern

### Step 1: Create Security Service

Create a security service in each microservice:

```typescript
// src/services/security.service.ts
import { 
    SecurityValidator, 
    RateLimiter, 
    BruteForceProtection, 
    SecurityHeaders,
    redisWrapper 
} from '@xmoonx/moon-lib';

class MyServiceSecurityService {
    public readonly validator: SecurityValidator;
    public readonly rateLimiter: RateLimiter;
    public readonly bruteForceProtection: BruteForceProtection;
    public readonly securityHeaders: SecurityHeaders;

    constructor() {
        // Initialize with service-specific configurations
        this.validator = new SecurityValidator({
            // Service-specific validation config
        });

        this.rateLimiter = new RateLimiter(redisWrapper.client, {
            // Service-specific rate limit config
        });

        this.bruteForceProtection = new BruteForceProtection(redisWrapper.client, {
            // Service-specific brute force config
        });

        this.securityHeaders = new SecurityHeaders({
            // Service-specific headers config
        });
    }

    // Service-specific methods
    getRateLimitMiddleware() {
        return this.rateLimiter.middleware();
    }

    getSecurityHeadersMiddleware() {
        return this.securityHeaders.middleware();
    }

    async validateInput(data: any) {
        return this.validator.validateInput(data);
    }
}

export const myServiceSecurity = new MyServiceSecurityService();
```

### Step 2: Apply Middleware in App

```typescript
// src/app.ts
import { myServiceSecurity } from './services/security.service';

const app = express();

// Security headers should be first
app.use(myServiceSecurity.getSecurityHeadersMiddleware());

// Other middleware...
app.use(json());

// Routes with security
app.use('/api/sensitive', myServiceSecurity.getRateLimitMiddleware());
```

### Step 3: Use in Routes

```typescript
// src/routes/myRoute.ts
import { myServiceSecurity } from '../services/security.service';

router.post('/api/data',
    myServiceSecurity.getRateLimitMiddleware(),
    async (req: Request, res: Response) => {
        // Validate input
        const result = await myServiceSecurity.validateInput(req.body);
        if (!result.isValid) {
            return res.status(400).json({ errors: result.errors });
        }

        // Process request...
    }
);
```

## Configuration Options

### SecurityValidator Config

```typescript
interface SecurityValidatorConfig {
    enableXSSProtection?: boolean;
    enableSQLInjectionProtection?: boolean;
    enableFileUploadValidation?: boolean;
    maxFileSize?: number; // bytes
    allowedFileTypes?: string[];
    maxInputLength?: number;
    enableInputSanitization?: boolean;
}
```

### RateLimiter Config

```typescript
interface RateLimiterConfig {
    windowMs?: number;
    maxRequests?: number;
    keyGenerator?: (req: Request) => string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
    enabled?: boolean;
}
```

### BruteForceProtection Config

```typescript
interface BruteForceConfig {
    maxAttempts?: number;
    windowMs?: number;
    blockDurationMs?: number;
    enabled?: boolean;
    skipSuccessfulRequests?: boolean;
}
```

### SecurityHeaders Config

```typescript
interface SecurityHeadersConfig {
    enableCSP?: boolean;
    enableHSTS?: boolean;
    enableXFrameOptions?: boolean;
    enableXContentTypeOptions?: boolean;
    enableXSSProtection?: boolean;
    enableReferrerPolicy?: boolean;
    csp?: {
        directives?: Record<string, string[]>;
        reportOnly?: boolean;
    };
    hsts?: {
        maxAge?: number;
        includeSubDomains?: boolean;
        preload?: boolean;
    };
}
```

## Testing

Tests should be written in the consuming microservices, not in moon-lib. Each microservice should test:

1. **Integration**: Verify security modules work with the service's Redis connection
2. **Configuration**: Test service-specific security configurations
3. **Middleware**: Test security middleware integration with routes
4. **Error Handling**: Test graceful handling of Redis errors and edge cases

Example test structure:

```typescript
// src/__tests__/security.integration.test.ts
describe('Service Security Integration', () => {
    describe('Security Service Configuration', () => {
        it('should initialize with correct dependencies', () => {
            // Test initialization
        });
    });

    describe('Input Validation', () => {
        it('should validate service-specific input', async () => {
            // Test validation
        });
    });

    describe('Rate Limiting', () => {
        it('should apply service-specific rate limits', async () => {
            // Test rate limiting
        });
    });

    // More tests...
});
```

## Best Practices

1. **Service-Specific Configuration**: Each microservice should configure security modules according to its specific needs
2. **Redis Dependency Injection**: Always pass the Redis client to modules that need it
3. **Middleware Order**: Security headers should be applied first, rate limiting before business logic
4. **Error Handling**: Implement graceful fallbacks for Redis connection errors
5. **Testing**: Write comprehensive integration tests in each consuming service
6. **Monitoring**: Log security events for monitoring and alerting

## Migration Guide

When migrating existing services to use these security modules:

1. Install/update `@xmoonx/moon-lib`
2. Create a security service for your microservice
3. Replace existing security middleware with new modules
4. Update Redis key namespaces if needed
5. Write integration tests
6. Deploy with monitoring

## Redis Key Conventions

The security modules use the following Redis key patterns:

- Rate Limiting: `{service}_rate_limit:{type}:{identifier}`
- Brute Force: `brute_force:{operation}:{identifier}`
- Examples:
  - `auth_rate_limit:ip:192.168.1.1`
  - `orders_rate_limit:user:user123`
  - `brute_force:attempts:user@example.com`
  - `brute_force:block:192.168.1.1`

## Support

For questions or issues with the security modules, please refer to the main project documentation or create an issue in the project repository.
