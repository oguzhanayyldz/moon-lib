// 🎯 Test-Friendly Export for moon-lib
// This file provides test-optimized versions of moon-lib exports

// Re-export everything from main index
export * from './index';

// Test-specific service factories (override main exports)

// NATS Wrapper - Test-friendly version
export const createNatsWrapper = () => ({
    client: {
        publish: jest.fn((subject: string, data: any, callback?: () => void) => {
            if (callback) callback();
            return Promise.resolve();
        }),
        subscribe: jest.fn(() => ({
            on: jest.fn(),
            unsubscribe: jest.fn()
        }))
    },
    connect: jest.fn().mockResolvedValue(undefined)
});

// Tracer - Test-friendly version with complete Span interface
export const createTracer = (config: any) => ({
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

// Redis Wrapper - Test-friendly version
export const createRedisWrapper = () => {
    const mockStorage: Record<string, any> = {};
    return {
        client: {
            set: jest.fn((key: string, value: any, options?: any) => {
                mockStorage[key] = value;
                return Promise.resolve('OK');
            }),
            get: jest.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
            del: jest.fn((key: string | string[]) => {
                if (Array.isArray(key)) {
                    key.forEach(k => delete mockStorage[k]);
                    return Promise.resolve(key.length);
                } else {
                    delete mockStorage[key];
                    return Promise.resolve(1);
                }
            }),
            incr: jest.fn((key: string) => {
                const current = parseInt(mockStorage[key] || '0');
                mockStorage[key] = (current + 1).toString();
                return Promise.resolve(current + 1);
            }),
            expire: jest.fn((key: string, seconds: number) => Promise.resolve(1)),
            scan: jest.fn((cursor: number, options?: any) => {
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
            lPush: jest.fn((key: string, value: string) => {
                if (!mockStorage[key]) mockStorage[key] = [];
                if (!Array.isArray(mockStorage[key])) mockStorage[key] = [];
                mockStorage[key].unshift(value);
                return Promise.resolve(mockStorage[key].length);
            }),
            lLen: jest.fn((key: string) => {
                if (Array.isArray(mockStorage[key])) {
                    return Promise.resolve(mockStorage[key].length);
                }
                return Promise.resolve(0);
            }),
            // Hash operations - SessionTracker için gerekli
            hSet: jest.fn((key: string, field: string, value: any) => {
                if (!mockStorage[key]) mockStorage[key] = {};
                if (typeof mockStorage[key] !== 'object') mockStorage[key] = {};
                mockStorage[key][field] = value;
                return Promise.resolve(1);
            }),
            hGet: jest.fn((key: string, field: string) => {
                if (!mockStorage[key] || typeof mockStorage[key] !== 'object') return Promise.resolve(null);
                return Promise.resolve(mockStorage[key][field] || null);
            }),
            hGetAll: jest.fn((key: string) => {
                if (!mockStorage[key] || typeof mockStorage[key] !== 'object') return Promise.resolve({});
                return Promise.resolve(mockStorage[key]);
            }),
            hDel: jest.fn((key: string, field: string) => {
                if (mockStorage[key] && typeof mockStorage[key] === 'object') {
                    delete mockStorage[key][field];
                    return Promise.resolve(1);
                }
                return Promise.resolve(0);
            }),
            // List operations - LoginAttempts için gerekli
            lTrim: jest.fn((key: string, start: number, stop: number) => {
                if (Array.isArray(mockStorage[key])) {
                    mockStorage[key] = mockStorage[key].slice(start, stop + 1);
                }
                return Promise.resolve('OK');
            }),
            lRange: jest.fn((key: string, start: number, stop: number) => {
                if (!Array.isArray(mockStorage[key])) return Promise.resolve([]);
                const end = stop === -1 ? mockStorage[key].length : stop + 1;
                return Promise.resolve(mockStorage[key].slice(start, end));
            }),
            quit: jest.fn().mockResolvedValue(undefined),
            on: jest.fn((event: string, handler: Function) => { }) // Add event listener mock
        },
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined)
    };
};

// Export redisWrapper instance for direct usage
export const redisWrapper = createRedisWrapper();

export const tracer = {
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