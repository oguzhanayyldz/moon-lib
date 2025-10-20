"use strict";
// 🎯 Test-Friendly Export for moon-lib
// This file provides test-optimized versions of moon-lib exports
//
// 🚀 SIMPLIFIED USAGE (Updated June 2025):
// - After git pull: Only `npm i` required, no build needed
// - Build ONLY when this file (index.test.ts) changes
// - Use: `npm run build:test` to build after modifying this file
// - Agent script automatically detects if build is needed
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupGlobalTestEnvironment = exports.cleanupTestEnvironment = exports.setIntervalTracked = exports.setTimeoutTracked = exports.createSecurityManager = exports.createSecurityHeaders = exports.createBruteForceProtection = exports.createRateLimiter = exports.createSecurityValidator = exports.SecurityManager = exports.SecurityHeaders = exports.BruteForceProtection = exports.RateLimiter = exports.SecurityValidator = exports.commonTestPatterns = exports.expectOptimisticLockingSaved = exports.expectOutboxEventCreated = exports.setupTestEnvironment = exports.createOutboxMock = exports.createOutboxModel = exports.RetryableListener = exports.EventPublisherJob = exports.EventPublisher = exports.OptimisticLockingUtil = exports.logger = exports.natsWrapper = exports.tracer = exports.microserviceSecurityService = exports.createMicroserviceSecurityService = exports.redisWrapper = exports.createRedisWrapper = exports.createTracer = exports.createNatsWrapper = exports.EnhancedEntityDeletionRegistry = void 0;
const index_1 = require("./index");
// Global test cleanup registry
let testTimers = new Set();
let originalSetInterval;
let originalClearInterval;
// Override setInterval to track all timers
if (!originalSetInterval) {
    originalSetInterval = global.setInterval;
    originalClearInterval = global.clearInterval;
    global.setInterval = ((fn, delay, ...args) => {
        const timer = originalSetInterval(fn, delay, ...args);
        testTimers.add(timer);
        return timer;
    });
    global.clearInterval = ((timer) => {
        testTimers.delete(timer);
        return originalClearInterval(timer);
    });
}
// Mock the BatchProcessingEngine to prevent interval creation during tests
jest.mock('./services/batchProcessingEngine.service', () => {
    class MockMemoryManager {
        constructor(config) {
            this.config = {};
            this.isMonitoring = false;
            this.monitoringInterval = null;
            this.config = config;
        }
        startMonitoring() {
            this.isMonitoring = true;
            // Don't create real setInterval - completely mocked
        }
        stopMonitoring() {
            this.isMonitoring = false;
        }
        checkMemoryUsage() {
            return { used: 0, total: 0 };
        }
    }
    class MockBatchProcessingEngine {
        constructor() {
            this.start = jest.fn();
            this.stop = jest.fn();
            this.process = jest.fn();
            this.queue = [];
            this.isRunning = false;
            this.memoryManager = new MockMemoryManager({});
            this.performanceMonitor = {
                startMonitoring: jest.fn(),
                stopMonitoring: jest.fn(),
                collectMetrics: jest.fn(),
                getMetrics: jest.fn(() => ({})),
            };
        }
    }
    return {
        BatchProcessingEngine: MockBatchProcessingEngine,
    };
});
// Mock PerformanceMonitor to prevent setInterval issues
jest.mock('./utils/performanceMonitor.util', () => {
    class MockPerformanceMonitor {
        constructor(config) {
            this.config = {};
            this.metrics = {};
            this.isMonitoring = false;
            this.monitoringInterval = null;
            this.config = config;
        }
        startMonitoring() {
            this.isMonitoring = true;
            // Don't create real setInterval - completely mocked
        }
        stopMonitoring() {
            this.isMonitoring = false;
        }
        collectMetrics() {
            return this.metrics;
        }
        getMetrics() {
            return this.metrics;
        }
    }
    return {
        PerformanceMonitor: MockPerformanceMonitor,
    };
});
// Mock problematic services first before importing
const mockEnhancedEntityDeletionRegistry = {
    getInstance: jest.fn(() => ({
        shutdown: jest.fn().mockResolvedValue(undefined),
        registerDeletionStrategy: jest.fn(),
        executeDeletion: jest.fn().mockResolvedValue({ success: true }),
        isStrategyRegistered: jest.fn().mockReturnValue(true),
        getAvailableStrategies: jest.fn().mockReturnValue([]),
        getMetrics: jest.fn().mockReturnValue({
            totalDeletions: 0,
            successfulDeletions: 0,
            failedDeletions: 0,
            averageExecutionTime: 0
        })
    }))
};
// Global cleanup function for all test timers
global.cleanupAllTestTimers = () => {
    // Clear all tracked timers
    testTimers.forEach(timer => {
        originalClearInterval(timer);
    });
    testTimers.clear();
    // Clear any remaining timers by brute force
    const highestId = originalSetInterval(() => { }, 0);
    for (let i = 0; i < highestId; i++) {
        try {
            originalClearInterval(i);
        }
        catch (e) {
            // Ignore errors
        }
    }
    originalClearInterval(highestId);
};
// Re-export everything from main index except problematic ones
__exportStar(require("./index"), exports);
// 🧪 Test-specific overrides for problematic services
exports.EnhancedEntityDeletionRegistry = mockEnhancedEntityDeletionRegistry;
// Test-specific service factories (override main exports)
// NATS Wrapper - Test-friendly version
const createNatsWrapper = () => ({
    client: {
        publish: jest.fn((subject, data, callback) => {
            if (callback)
                callback();
            return 'guid-' + Math.random().toString(36); // Stan publish returns string GUID
        }),
        subscribe: jest.fn(() => ({
            on: jest.fn(),
            unsubscribe: jest.fn(),
            setManualAckMode: jest.fn().mockReturnThis(),
            setAckWait: jest.fn().mockReturnThis(),
            setDurableName: jest.fn().mockReturnThis(),
            setDeliverAllAvailable: jest.fn().mockReturnThis(),
            setMaxInFlight: jest.fn().mockReturnThis(),
            setStartWithLastReceived: jest.fn().mockReturnThis(),
            setStartAtSequence: jest.fn().mockReturnThis(),
            setStartTime: jest.fn().mockReturnThis(),
            setStartAtTimeDelta: jest.fn().mockReturnThis(),
            close: jest.fn()
        })),
        subscriptionOptions: jest.fn(() => ({
            setManualAckMode: jest.fn().mockReturnThis(),
            setAckWait: jest.fn().mockReturnThis(),
            setDurableName: jest.fn().mockReturnThis(),
            setDeliverAllAvailable: jest.fn().mockReturnThis()
        })),
        // Stan interface EventEmitter methods
        close: jest.fn(),
        addListener: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
        prependListener: jest.fn(),
        prependOnceListener: jest.fn(),
        removeListener: jest.fn(),
        off: jest.fn(),
        removeAllListeners: jest.fn(),
        setMaxListeners: jest.fn(),
        getMaxListeners: jest.fn().mockReturnValue(10),
        listeners: jest.fn().mockReturnValue([]),
        rawListeners: jest.fn().mockReturnValue([]),
        emit: jest.fn().mockReturnValue(true),
        eventNames: jest.fn().mockReturnValue([]),
        listenerCount: jest.fn().mockReturnValue(0)
    },
    connect: jest.fn().mockResolvedValue(undefined)
});
exports.createNatsWrapper = createNatsWrapper;
// Tracer - Test-friendly version with complete Span interface
const createTracer = (config) => ({
    startSpan: jest.fn(() => ({
        // Core Span methods
        setTag: jest.fn().mockReturnThis(),
        finish: jest.fn(),
        log: jest.fn().mockReturnThis(),
        setOperationName: jest.fn().mockReturnThis(),
        // Missing Span properties
        context: jest.fn().mockReturnValue({}),
        tracer: jest.fn().mockReturnValue({}),
        setBaggageItem: jest.fn().mockReturnThis(),
        getBaggageItem: jest.fn(),
        addTags: jest.fn().mockReturnThis(),
        setTags: jest.fn().mockReturnThis(),
        addReference: jest.fn().mockReturnThis(),
        followsFrom: jest.fn().mockReturnThis(),
        childOf: jest.fn().mockReturnThis(),
        logEvent: jest.fn().mockReturnThis(),
        logFields: jest.fn().mockReturnThis(),
        // Additional properties that might be needed
        uuid: jest.fn().mockReturnValue('mock-span-id'),
        operationName: jest.fn().mockReturnValue('mock-operation'),
        startTime: jest.fn().mockReturnValue(Date.now())
    })),
    inject: jest.fn(),
    extract: jest.fn(),
    close: jest.fn()
});
exports.createTracer = createTracer;
// Redis Wrapper - Test-friendly version
const createRedisWrapper = () => {
    const mockStorage = {};
    return {
        client: {
            set: jest.fn((key, value, options) => {
                mockStorage[key] = value;
                return Promise.resolve('OK');
            }),
            get: jest.fn((key) => Promise.resolve(mockStorage[key] || null)),
            del: jest.fn((key) => {
                if (Array.isArray(key)) {
                    key.forEach(k => delete mockStorage[k]);
                    return Promise.resolve(key.length);
                }
                else {
                    delete mockStorage[key];
                    return Promise.resolve(1);
                }
            }),
            incr: jest.fn((key) => {
                const current = parseInt(mockStorage[key] || '0');
                mockStorage[key] = (current + 1).toString();
                return Promise.resolve(current + 1);
            }),
            expire: jest.fn((key, seconds) => Promise.resolve(1)),
            scan: jest.fn((cursor, options) => {
                // Mock return format expected by signoutAll.ts: { cursor, keys }
                const mockKeys = Object.keys(mockStorage).filter(key => {
                    if (options && options.MATCH) {
                        // Simple pattern matching for MATCH option
                        const pattern = options.MATCH.replace(/\*/g, '.*');
                        const regex = new RegExp(pattern);
                        return regex.test(key);
                    }
                    return true;
                });
                return Promise.resolve({ cursor: 0, keys: mockKeys });
            }),
            lPush: jest.fn((key, value) => {
                if (!mockStorage[key])
                    mockStorage[key] = [];
                if (!Array.isArray(mockStorage[key]))
                    mockStorage[key] = [];
                mockStorage[key].unshift(value);
                return Promise.resolve(mockStorage[key].length);
            }),
            lLen: jest.fn((key) => {
                if (Array.isArray(mockStorage[key])) {
                    return Promise.resolve(mockStorage[key].length);
                }
                return Promise.resolve(0);
            }),
            // Hash operations - SessionTracker için gerekli
            hSet: jest.fn((key, fieldOrObject, value) => {
                if (!mockStorage[key])
                    mockStorage[key] = {};
                if (typeof mockStorage[key] !== 'object')
                    mockStorage[key] = {};
                // Support both signatures: hSet(key, field, value) and hSet(key, object)
                if (typeof fieldOrObject === 'object') {
                    Object.assign(mockStorage[key], fieldOrObject);
                    return Promise.resolve(Object.keys(fieldOrObject).length);
                }
                else {
                    mockStorage[key][fieldOrObject] = value;
                    return Promise.resolve(1);
                }
            }),
            hGet: jest.fn((key, field) => {
                if (!mockStorage[key] || typeof mockStorage[key] !== 'object')
                    return Promise.resolve(null);
                return Promise.resolve(mockStorage[key][field] || null);
            }),
            hGetAll: jest.fn((key) => {
                if (!mockStorage[key] || typeof mockStorage[key] !== 'object')
                    return Promise.resolve({});
                return Promise.resolve(mockStorage[key]);
            }),
            hDel: jest.fn((key, field) => {
                if (mockStorage[key] && typeof mockStorage[key] === 'object') {
                    delete mockStorage[key][field];
                    return Promise.resolve(1);
                }
                return Promise.resolve(0);
            }),
            // List operations - LoginAttempts için gerekli
            lTrim: jest.fn((key, start, stop) => {
                if (Array.isArray(mockStorage[key])) {
                    mockStorage[key] = mockStorage[key].slice(start, stop + 1);
                }
                return Promise.resolve('OK');
            }),
            lRange: jest.fn((key, start, stop) => {
                if (!Array.isArray(mockStorage[key]))
                    return Promise.resolve([]);
                const end = stop === -1 ? mockStorage[key].length : stop + 1;
                return Promise.resolve(mockStorage[key].slice(start, end));
            }),
            // Additional operations for permission caching
            keys: jest.fn((pattern) => {
                const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
                const regex = new RegExp(`^${regexPattern}$`);
                const matchingKeys = Object.keys(mockStorage).filter(key => regex.test(key));
                return Promise.resolve(matchingKeys);
            }),
            exists: jest.fn((key) => {
                return Promise.resolve(mockStorage[key] !== undefined ? 1 : 0);
            }),
            ttl: jest.fn((key) => {
                // Mock TTL - always return a value indicating key has TTL
                // In real implementation, this would track expiration times
                return Promise.resolve(mockStorage[key] !== undefined ? 300 : -2);
            }),
            quit: jest.fn().mockResolvedValue(undefined),
            on: jest.fn((event, handler) => { }) // Add event listener mock
        },
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        getOrder: jest.fn().mockResolvedValue(null),
        setOrder: jest.fn().mockResolvedValue('OK'),
        delOrder: jest.fn().mockResolvedValue(1),
    };
};
exports.createRedisWrapper = createRedisWrapper;
// Export redisWrapper instance for direct usage
exports.redisWrapper = (0, exports.createRedisWrapper)();
// Security Services - Test-friendly version
const createMicroserviceSecurityService = (config = {}) => {
    const defaultConfig = {
        serviceName: 'test-service',
        requestWindowMs: 15 * 60 * 1000,
        maxRequestsPerWindow: 100,
        maxLoginAttempts: 5,
        lockoutTimeMinutes: 15,
        apiPathRegex: /\/api\/.*/,
        enableXSSProtection: true,
        enableSQLInjectionProtection: true,
        enableFileUploadValidation: true,
        maxFileSize: 5 * 1024 * 1024, // 5MB
        allowedFileTypes: ['jpg', 'jpeg', 'png', 'pdf'],
        enableCSP: true,
        enableHSTS: true,
        enableXFrameOptions: true,
        enableXContentTypeOptions: true,
        jwtKey: 'test-jwt-key-for-tests-only'
    };
    const mockConfig = Object.assign(Object.assign({}, defaultConfig), config);
    // Mock validation result
    const mockValidationResult = { isValid: true, errors: [] };
    // Create mock for basic middleware structure
    const createMockMiddleware = () => jest.fn().mockImplementation((req, res, next) => {
        // Cookie ayarlama fonksiyonalitesini ekle
        const originalSend = res.send;
        res.send = function (body) {
            // Eğer session ve JWT varsa cookie'yi ayarla
            if (req.session && req.session.jwt) {
                if (!res.getHeader('Set-Cookie')) {
                    res.setHeader('Set-Cookie', [`session=${req.session.jwt}; path=/; httpOnly`]);
                }
            }
            return originalSend.call(this, body);
        };
        next();
    });
    // JWT oluşturma ve cookie yardımcı fonksiyonu
    const createSessionJWT = (user) => {
        try {
            // Test ortamında doğru bir JWT oluştur
            const jwt = require('jsonwebtoken');
            const payload = {
                id: user.id || '123-test-id',
                email: user.email || 'test@example.com',
                name: user.name || 'Test User',
                sessionId: user.sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            };
            // JWT KEY'i test ortamından veya tanımlı değerden al
            const jwtKey = process.env.JWT_KEY || mockConfig.jwtKey;
            return jwt.sign(payload, jwtKey);
        }
        catch (error) {
            console.error('JWT Token oluşturma hatası:', error);
            return 'mock-jwt-test-token';
        }
    };
    // Cookie ayarlama işlemi için yardımcı fonksiyon
    const setSessionCookie = (req, res, jwt) => {
        if (req && req.session) {
            req.session.jwt = jwt;
        }
        // Cookie header'larını ekle
        res.cookie = res.cookie || function (name, value, options) {
            const cookieHeader = `${name}=${value}; path=${(options === null || options === void 0 ? void 0 : options.path) || '/'}${(options === null || options === void 0 ? void 0 : options.httpOnly) ? '; httpOnly' : ''}`;
            if (!res.getHeader('Set-Cookie')) {
                res.setHeader('Set-Cookie', [cookieHeader]);
            }
            else {
                const existingCookies = res.getHeader('Set-Cookie');
                if (Array.isArray(existingCookies)) {
                    res.setHeader('Set-Cookie', [...existingCookies, cookieHeader]);
                }
                else {
                    res.setHeader('Set-Cookie', [existingCookies, cookieHeader]);
                }
            }
            return res;
        };
        return res.cookie('session', jwt, { httpOnly: true, path: '/' });
    };
    return {
        config: mockConfig,
        createSessionJWT,
        setSessionCookie,
        // Validator mock
        validator: {
            validateInput: jest.fn().mockResolvedValue(mockValidationResult),
            validateFileUpload: jest.fn().mockResolvedValue({
                isValid: true,
                errors: []
            }),
            sanitizeInput: jest.fn(input => input),
            detectSQLInjection: jest.fn().mockReturnValue(false),
            detectNoSQLInjection: jest.fn().mockReturnValue(false)
        },
        // Rate limiter mock
        rateLimiter: {
            middleware: createMockMiddleware(),
            reset: jest.fn().mockResolvedValue(undefined)
        },
        // Brute force protection mock
        bruteForceProtection: {
            loginProtection: createMockMiddleware(),
            handleFailedLogin: jest.fn().mockReturnValue(createMockMiddleware()),
            recordFailedAttempt: jest.fn().mockResolvedValue(undefined),
            getStatus: jest.fn().mockResolvedValue({
                allowed: true,
                remainingTime: 0
            }),
            isBlocked: jest.fn().mockResolvedValue(false),
            getAttemptCount: jest.fn().mockResolvedValue(0)
        },
        // Security headers mock
        securityHeaders: {
            middleware: createMockMiddleware()
        },
        // Security manager mock
        securityManager: {},
        // Core middleware methods
        getRateLimitMiddleware: createMockMiddleware,
        getBruteForceMiddleware: createMockMiddleware,
        getSecurityHeadersMiddleware: createMockMiddleware,
        getFailedLoginHandlerMiddleware: createMockMiddleware,
        getUserRateLimitMiddleware: createMockMiddleware,
        getFileUploadValidationMiddleware: createMockMiddleware,
        // CSRF koruması ve NoSQL sanitization
        getNoSQLSanitizerMiddleware: createMockMiddleware,
        getJwtCsrfProtectionMiddleware: createMockMiddleware,
        generateCsrfToken: jest.fn().mockReturnValue('mock-csrf-token-for-testing'),
        // Core validation methods
        validateInput: jest.fn().mockResolvedValue(mockValidationResult),
        validateFileUpload: jest.fn().mockResolvedValue({
            isValid: true,
            errors: []
        }),
        // Status and tracking methods
        getStatus: jest.fn().mockResolvedValue({
            allowed: true,
            remainingTime: 0
        }),
        recordFailedAttempt: jest.fn().mockResolvedValue(undefined),
        isBlocked: jest.fn().mockResolvedValue(false),
        getAttemptCount: jest.fn().mockResolvedValue(0)
    };
};
exports.createMicroserviceSecurityService = createMicroserviceSecurityService;
// Export mock security service instances for direct usage in tests
exports.microserviceSecurityService = (0, exports.createMicroserviceSecurityService)();
exports.tracer = {
    startSpan: jest.fn().mockReturnValue({
        setTag: jest.fn().mockReturnThis(),
        finish: jest.fn().mockReturnThis(),
        log: jest.fn().mockReturnThis()
    }),
    inject: jest.fn(),
    getMockSpan: jest.fn().mockReturnValue({
        setTag: jest.fn().mockReturnThis(),
        finish: jest.fn().mockReturnThis(),
        log: jest.fn().mockReturnThis()
    }),
    clearMock: jest.fn(), // Added clearMock to the tracer mock
};
// NATS Wrapper - Centralized mock instance
exports.natsWrapper = {
    client: {
        publish: jest.fn().mockImplementation((subject, data, callback) => {
            callback();
        }),
        // Stan interface için gerekli diğer metotlar
        close: jest.fn(),
        subscribe: jest.fn().mockReturnValue({
            on: jest.fn(),
            setDeliverAllAvailable: jest.fn().mockReturnThis(),
            setDurableName: jest.fn().mockReturnThis(),
            setManualAckMode: jest.fn().mockReturnThis(),
            setAckWait: jest.fn().mockReturnThis(),
            setMaxInFlight: jest.fn().mockReturnThis(),
            setDeliverToAll: jest.fn().mockReturnThis(),
            setStartAtSequence: jest.fn().mockReturnThis(),
            setStartAtTimeDelta: jest.fn().mockReturnThis(),
            setStartAtTime: jest.fn().mockReturnThis(),
            setStartWithLastReceived: jest.fn().mockReturnThis(),
            close: jest.fn(),
        }),
        subscriptionOptions: jest.fn().mockReturnValue({
            setDeliverAllAvailable: jest.fn().mockReturnThis(),
            setDurableName: jest.fn().mockReturnThis(),
            setManualAckMode: jest.fn().mockReturnThis(),
            setAckWait: jest.fn().mockReturnThis(),
            setMaxInFlight: jest.fn().mockReturnThis(),
            setDeliverToAll: jest.fn().mockReturnThis(),
            setStartAtSequence: jest.fn().mockReturnThis(),
            setStartAtTimeDelta: jest.fn().mockReturnThis(),
            setStartAtTime: jest.fn().mockReturnThis(),
            setStartWithLastReceived: jest.fn().mockReturnThis(),
        }),
        on: jest.fn(),
        off: jest.fn(),
        once: jest.fn(),
        prependListener: jest.fn(),
        prependOnceListener: jest.fn(),
        removeListener: jest.fn(),
        removeAllListeners: jest.fn(),
        setMaxListeners: jest.fn(),
        getMaxListeners: jest.fn(),
        listeners: jest.fn(),
        rawListeners: jest.fn(),
        emit: jest.fn(),
        eventNames: jest.fn(),
        listenerCount: jest.fn(),
        addListener: jest.fn(),
    },
    connect: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockReturnValue(true),
};
// Logger - Centralized mock
exports.logger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn()
};
// OptimisticLockingUtil - Centralized mock
exports.OptimisticLockingUtil = {
    saveWithRetry: jest.fn().mockImplementation(async (doc, operationName) => {
        // Mock save metodu - gerçek implementasyonu simüle et
        if (doc && typeof doc.save === 'function') {
            return await doc.save();
        }
        // Eğer save metodu yoksa mock bir sonuç döndür
        return Object.assign(Object.assign({}, doc), { _id: doc.id || 'mock-id' });
    }),
    updateWithRetry: jest.fn().mockImplementation(async (model, id, updateData, options = {}) => {
        const result = await model.findByIdAndUpdate(id, updateData, Object.assign({ new: true, omitUndefined: true }, options));
        if (!result) {
            throw new Error(`Document not found: ${id}`);
        }
        return result;
    }),
    retryWithOptimisticLocking: jest.fn().mockImplementation(async (operation, maxRetries = 3, backoffMs = 100, operationName = 'operation') => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await operation();
                if (attempt > 1) {
                    exports.logger.info(`${operationName} başarılı (attempt ${attempt}/${maxRetries})`);
                }
                return result;
            }
            catch (error) {
                const isVersionError = error instanceof Error && (error.message.includes('version') ||
                    error.message.includes('VersionError') ||
                    error.message.includes('No matching document found'));
                if (isVersionError && attempt < maxRetries) {
                    const delayMs = backoffMs * Math.pow(2, attempt - 1);
                    exports.logger.warn(`${operationName} version conflict (attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                    continue;
                }
                exports.logger.error(`${operationName} failed after ${attempt} attempts:`, error);
                throw error;
            }
        }
        throw new Error(`${operationName}: Maximum retry attempts (${maxRetries}) reached`);
    }),
    getSessionFromRequest: jest.fn().mockImplementation((req) => {
        return (req === null || req === void 0 ? void 0 : req.dbSession) || undefined;
    }),
    isInTransaction: jest.fn().mockImplementation((req) => {
        var _a, _b;
        return ((_b = (_a = req === null || req === void 0 ? void 0 : req.dbSession) === null || _a === void 0 ? void 0 : _a.inTransaction) === null || _b === void 0 ? void 0 : _b.call(_a)) || false;
    }),
    getStats: jest.fn().mockImplementation((req) => {
        var _a, _b;
        const hasSession = !!(req === null || req === void 0 ? void 0 : req.dbSession);
        const inTransaction = hasSession && ((_b = (_a = req.dbSession).inTransaction) === null || _b === void 0 ? void 0 : _b.call(_a));
        const sessionId = hasSession ? req.dbSession.id : undefined;
        return {
            hasSession,
            inTransaction,
            sessionId,
            features: {
                sessionAware: true,
                contextAware: true
            }
        };
    })
};
exports.EventPublisher = {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
    processEvents: jest.fn().mockResolvedValue(undefined),
    monitorFailedEvents: jest.fn().mockResolvedValue(undefined),
    publishEvent: jest.fn().mockResolvedValue(undefined)
};
exports.EventPublisherJob = jest.fn().mockReturnValue(exports.EventPublisher);
const RetryableListener = class MockRetryableListener {
    constructor(client, options = {}) {
        this.subject = index_1.Subjects.EntityDeleted;
        this.queueGroupName = 'test-service';
        this.retryOptions = {
            maxRetries: (options === null || options === void 0 ? void 0 : options.maxRetries) || 3,
            deadLetterMaxRetries: (options === null || options === void 0 ? void 0 : options.deadLetterMaxRetries) || 5,
            enableDeadLetter: (options === null || options === void 0 ? void 0 : options.enableDeadLetter) !== false
        };
    }
    // RetryableListener'ın retry mantığını simüle et
    async onMessage(data, msg) {
        const eventId = this.getEventId(data);
        const retryKey = `retry:${this.subject}:${eventId}`;
        try {
            // RetryCount kontrol et - await kullanarak
            const retryCountStr = await exports.redisWrapper.client.get(retryKey);
            const retryCount = retryCountStr ? parseInt(retryCountStr, 10) : 0;
            exports.logger.info(`[Mock] Processing event ${this.subject}:${eventId}, retry count: ${retryCount}`);
            if (retryCount >= this.retryOptions.maxRetries) {
                // Max retry aşıldı, ack gönder ve dead letter'a ekle
                msg.ack();
                if (this.retryOptions.enableDeadLetter) {
                    exports.logger.info(`[Mock] Moving to dead letter queue: ${this.subject}:${eventId}`);
                }
                return;
            }
            // İşlemi çalıştır
            await this.processEvent(data);
            exports.logger.info(`[Mock] Event processed successfully: ${this.subject}:${eventId}`);
            // Başarılı, retry sayacını sıfırla
            await exports.redisWrapper.client.del(retryKey);
            msg.ack();
        }
        catch (error) {
            // Hata durumunda retry sayacını artır
            const retryCountStr = await exports.redisWrapper.client.get(retryKey);
            const retryCount = retryCountStr ? parseInt(retryCountStr, 10) : 0;
            const newCount = retryCount + 1;
            exports.logger.info(`[Mock] Retry attempt ${newCount} for ${this.subject}:${eventId}`);
            exports.logger.info(`[Debug] Redis set çağrısı yapılıyor, key: ${retryKey}, value: ${newCount}`);
            await exports.redisWrapper.client.set(retryKey, newCount.toString());
            exports.logger.info('[Debug] Redis set çağrısı tamamlandı');
            // Max retry aşıldıysa ack ve dead letter
            if (newCount >= this.retryOptions.maxRetries) {
                msg.ack();
                if (this.retryOptions.enableDeadLetter) {
                    exports.logger.info(`[Mock] Moving to dead letter queue after max retries: ${this.subject}:${eventId}`);
                }
            }
            // Değilse hatayı fırlat, test içinde yakalanacak
            else {
                throw error;
            }
        }
    }
    // Alt sınıflar tarafından override edilecek
    async processEvent(data) {
        // Boş implementasyon
    }
    // Alt sınıflar tarafından override edilecek
    getEventId(data) {
        return 'mock-id';
    }
};
exports.RetryableListener = RetryableListener;
// Model Creation Functions - Test-friendly versions
exports.createOutboxModel = jest.fn(() => ({
    build: jest.fn().mockReturnValue({
        save: jest.fn().mockResolvedValue({
            _id: 'mock-outbox-id',
            __v: 0
        })
    }),
    create: jest.fn().mockResolvedValue({
        _id: 'mock-outbox-id',
        __v: 0
    }),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    deleteOne: jest.fn(),
    updateOne: jest.fn()
}));
// Outbox Mock - Universal mock for all services
const createOutboxMock = () => {
    const mockOutboxConstructor = jest.fn().mockImplementation(() => ({
        save: jest.fn().mockResolvedValue({
            _id: 'mock-outbox-id',
            __v: 0
        })
    }));
    // Static methods - All Mongoose model methods
    mockOutboxConstructor.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 0 });
    mockOutboxConstructor.findOne = jest.fn().mockResolvedValue(null);
    mockOutboxConstructor.find = jest.fn().mockResolvedValue([]);
    mockOutboxConstructor.create = jest.fn().mockResolvedValue({
        _id: 'mock-outbox-id',
        __v: 0
    });
    mockOutboxConstructor.updateOne = jest.fn().mockResolvedValue({ nModified: 1 });
    mockOutboxConstructor.updateMany = jest.fn().mockResolvedValue({ nModified: 0 });
    mockOutboxConstructor.findById = jest.fn().mockResolvedValue(null);
    mockOutboxConstructor.findByIdAndUpdate = jest.fn().mockResolvedValue(null);
    mockOutboxConstructor.findByIdAndDelete = jest.fn().mockResolvedValue(null);
    mockOutboxConstructor.countDocuments = jest.fn().mockResolvedValue(0);
    mockOutboxConstructor.aggregate = jest.fn().mockResolvedValue([]);
    return {
        Outbox: mockOutboxConstructor
    };
};
exports.createOutboxMock = createOutboxMock;
// Global Test Setup Helper - All services can use this
const setupTestEnvironment = () => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    // Reset OptimisticLockingUtil to default behavior
    exports.OptimisticLockingUtil.saveWithRetry = jest.fn().mockImplementation(async (doc, operationName) => {
        if (doc && typeof doc.save === 'function') {
            return await doc.save();
        }
        return Object.assign(Object.assign({}, doc), { _id: doc.id || 'mock-id' });
    });
    // Reset NATS publish mock
    exports.natsWrapper.client.publish = jest.fn().mockImplementation((subject, data, callback) => {
        if (callback)
            callback();
        return 'mock-guid-' + Math.random().toString(36).substr(2, 9);
    });
    // Reset logger
    Object.keys(exports.logger).forEach(key => {
        exports.logger[key] = jest.fn();
    });
    // Reset Redis wrapper
    const mockStorage = {};
    exports.redisWrapper.client.set = jest.fn((key, value) => {
        mockStorage[key] = value;
        return Promise.resolve('OK');
    });
    exports.redisWrapper.client.get = jest.fn((key) => Promise.resolve(mockStorage[key] || null));
    exports.redisWrapper.client.del = jest.fn((key) => {
        if (Array.isArray(key)) {
            key.forEach(k => delete mockStorage[k]);
            return Promise.resolve(key.length);
        }
        else {
            delete mockStorage[key];
            return Promise.resolve(1);
        }
    });
};
exports.setupTestEnvironment = setupTestEnvironment;
// Test Mock Verification Helpers
const expectOutboxEventCreated = (mockOutboxConstructor, expectedEventType, expectedPayloadProps = {}) => {
    expect(mockOutboxConstructor).toHaveBeenCalledWith(expect.objectContaining({
        eventType: expectedEventType,
        payload: expect.objectContaining(expectedPayloadProps),
        status: 'pending'
    }));
};
exports.expectOutboxEventCreated = expectOutboxEventCreated;
const expectOptimisticLockingSaved = (times = 1) => {
    expect(exports.OptimisticLockingUtil.saveWithRetry).toHaveBeenCalledTimes(times);
};
exports.expectOptimisticLockingSaved = expectOptimisticLockingSaved;
// Common Test Patterns
exports.commonTestPatterns = {
    // Event creation test helper
    expectEventPublished: (mockOutboxConstructor, eventType, payloadCheck = {}) => {
        expect(exports.OptimisticLockingUtil.saveWithRetry).toHaveBeenCalled();
        (0, exports.expectOutboxEventCreated)(mockOutboxConstructor, eventType, payloadCheck);
    },
    // Authentication test helper
    expectUnauthorized: (response) => {
        expect(response.status).toBe(401);
    },
    // Not found test helper
    expectNotFound: (response) => {
        expect(response.status).toBe(404);
    },
    // Bad request test helper
    expectBadRequest: (response) => {
        expect(response.status).toBe(400);
    },
    // Success test helper
    expectSuccess: (response, expectedStatus = 200) => {
        expect(response.status).toBe(expectedStatus);
        expect(response.body).toBeDefined();
    }
};
// Security Module Mocks - Constructor mockları ekliyoruz
exports.SecurityValidator = jest.fn().mockImplementation((config) => ({
    validateRequest: jest.fn().mockImplementation((req, res, next) => {
        // Mock validation - always pass
        next();
    }),
    validateInput: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
    sanitizeInput: jest.fn().mockImplementation((input) => input),
    validatePassword: jest.fn().mockReturnValue({ isValid: true, score: 4 }),
    validateEmail: jest.fn().mockReturnValue(true),
    validateSecurityHeaders: jest.fn().mockReturnValue(true),
    config
}));
exports.RateLimiter = jest.fn().mockImplementation((redisClient, config) => ({
    checkRateLimit: jest.fn().mockResolvedValue({
        allowed: true,
        remaining: 10,
        resetTime: Date.now() + 60000
    }),
    getRateLimitStatus: jest.fn().mockResolvedValue({
        remaining: 10,
        resetTime: Date.now() + 60000,
        limit: 100
    }),
    redisClient,
    config
}));
exports.BruteForceProtection = jest.fn().mockImplementation((redisClient, config) => ({
    checkAttempt: jest.fn().mockResolvedValue({
        allowed: true,
        remainingAttempts: 5,
        lockoutTime: null
    }),
    recordAttempt: jest.fn().mockResolvedValue(undefined),
    resetAttempts: jest.fn().mockResolvedValue(undefined),
    getAttemptStatus: jest.fn().mockResolvedValue({
        attempts: 0,
        remainingAttempts: 5,
        isLocked: false,
        lockoutTime: null
    }),
    redisClient,
    config
}));
exports.SecurityHeaders = jest.fn().mockImplementation((config) => ({
    setSecurityHeaders: jest.fn().mockImplementation((req, res, next) => {
        // Mock security headers middleware
        res.set({
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
            'Content-Security-Policy': "default-src 'self'"
        });
        next();
    }),
    config
}));
exports.SecurityManager = jest.fn().mockImplementation((config, modules) => ({
    initializeMiddleware: jest.fn().mockImplementation((app) => {
        // Mock middleware initialization
        return app;
    }),
    validateSecurityConfig: jest.fn().mockReturnValue(true),
    getSecurityStatus: jest.fn().mockReturnValue({
        validator: 'active',
        rateLimiter: 'active',
        bruteForceProtection: 'active',
        securityHeaders: 'active'
    }),
    modules,
    config
}));
// Factory functions for security modules (yeni pattern için)
exports.createSecurityValidator = jest.fn().mockImplementation((config) => new exports.SecurityValidator(config));
exports.createRateLimiter = jest.fn().mockImplementation((redisClient, config) => new exports.RateLimiter(redisClient, config));
exports.createBruteForceProtection = jest.fn().mockImplementation((redisClient, config) => new exports.BruteForceProtection(redisClient, config));
exports.createSecurityHeaders = jest.fn().mockImplementation((config) => new exports.SecurityHeaders(config));
exports.createSecurityManager = jest.fn().mockImplementation((config, modules) => new exports.SecurityManager(config, modules));
// ✅ Global Test Cleanup System
let globalTimers = [];
let globalIntervals = [];
// Timer tracking için wrapper functions
const setTimeoutTracked = (callback, delay) => {
    const timer = setTimeout(callback, delay);
    globalTimers.push(timer);
    return timer;
};
exports.setTimeoutTracked = setTimeoutTracked;
const setIntervalTracked = (callback, delay) => {
    const interval = setInterval(callback, delay);
    globalIntervals.push(interval);
    return interval;
};
exports.setIntervalTracked = setIntervalTracked;
// Global cleanup function
const cleanupTestEnvironment = async () => {
    try {
        // Clear all tracked timers
        globalTimers.forEach(timer => clearTimeout(timer));
        globalTimers = [];
        // Clear all tracked intervals
        globalIntervals.forEach(interval => clearInterval(interval));
        globalIntervals = [];
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }
        // Small delay to let async operations complete
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log('✅ Test environment cleanup completed');
    }
    catch (error) {
        console.error('❌ Test cleanup error:', error);
    }
};
exports.cleanupTestEnvironment = cleanupTestEnvironment;
// Jest global setup/teardown hooks
const setupGlobalTestEnvironment = () => {
    // Override global setTimeout and setInterval to track them
    const originalSetTimeout = global.setTimeout;
    const originalSetInterval = global.setInterval;
    global.setTimeout = exports.setTimeoutTracked;
    global.setInterval = exports.setIntervalTracked;
    // Restore originals in cleanup
    return () => {
        global.setTimeout = originalSetTimeout;
        global.setInterval = originalSetInterval;
    };
};
exports.setupGlobalTestEnvironment = setupGlobalTestEnvironment;
//# sourceMappingURL=index.test.js.map