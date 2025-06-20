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
exports.commonTestPatterns = exports.expectOptimisticLockingSaved = exports.expectOutboxEventCreated = exports.setupTestEnvironment = exports.createOutboxMock = exports.createOutboxModel = exports.RetryableListener = exports.EventPublisherJob = exports.EventPublisher = exports.OptimisticLockingUtil = exports.logger = exports.natsWrapper = exports.tracer = exports.redisWrapper = exports.createRedisWrapper = exports.createTracer = exports.createNatsWrapper = void 0;
const index_1 = require("./index");
// Re-export everything from main index
__exportStar(require("./index"), exports);
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
            hSet: jest.fn((key, field, value) => {
                if (!mockStorage[key])
                    mockStorage[key] = {};
                if (typeof mockStorage[key] !== 'object')
                    mockStorage[key] = {};
                mockStorage[key][field] = value;
                return Promise.resolve(1);
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
        this.queueGroupName = 'catalog-service';
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
//# sourceMappingURL=index.test.js.map