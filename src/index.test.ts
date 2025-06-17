// 🎯 Test-Friendly Export for moon-lib
// This file provides test-optimized versions of moon-lib exports

import { Subjects } from './index';

// Re-export everything from main index
export * from './index';

// Test-specific service factories (override main exports)

// NATS Wrapper - Test-friendly version
export const createNatsWrapper = () => ({
    client: {
        publish: jest.fn((subject: string, data: any, callback?: () => void) => {
            if (callback) callback();
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
        disconnect: jest.fn().mockResolvedValue(undefined),
        getOrder: jest.fn().mockResolvedValue(null),
        setOrder: jest.fn().mockResolvedValue('OK'),
        delOrder: jest.fn().mockResolvedValue(1),
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

// NATS Wrapper - Centralized mock instance
export const natsWrapper = {
    client: {
        publish: jest.fn().mockImplementation((subject: string, data: string, callback: () => void) => {
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
export const logger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn()
};

// OptimisticLockingUtil - Centralized mock
export const OptimisticLockingUtil = {
    saveWithRetry: jest.fn().mockImplementation(async (doc, operationName) => {
        // Mock save metodu - gerçek implementasyonu simüle et
        if (doc && typeof doc.save === 'function') {
            return await doc.save();
        }
        // Eğer save metodu yoksa mock bir sonuç döndür
        return { ...doc, _id: doc.id || 'mock-id' };
    }),
    updateWithRetry: jest.fn().mockImplementation(
        async (model, id, updateData, options = {}) => {
            const result = await model.findByIdAndUpdate(
                id,
                updateData,
                { new: true, omitUndefined: true, ...options }
            );

            if (!result) {
                throw new Error(`Document not found: ${id}`);
            }

            return result;
        }
    ),
    retryWithOptimisticLocking: jest.fn().mockImplementation(async (operation, maxRetries = 3, backoffMs = 100, operationName = 'operation') => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await operation();
                if (attempt > 1) {
                    logger.info(`${operationName} başarılı (attempt ${attempt}/${maxRetries})`);
                }
                return result;
            } catch (error: any) {
                const isVersionError = error instanceof Error && (
                    error.message.includes('version') ||
                    error.message.includes('VersionError') ||
                    error.message.includes('No matching document found')
                );

                if (isVersionError && attempt < maxRetries) {
                    const delayMs = backoffMs * Math.pow(2, attempt - 1);
                    logger.warn(`${operationName} version conflict (attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                    continue;
                }

                logger.error(`${operationName} failed after ${attempt} attempts:`, error);
                throw error;
            }
        }

        throw new Error(`${operationName}: Maximum retry attempts (${maxRetries}) reached`);
    })
};

export const EventPublisher = {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
    processEvents: jest.fn().mockResolvedValue(undefined),
    monitorFailedEvents: jest.fn().mockResolvedValue(undefined),
    publishEvent: jest.fn().mockResolvedValue(undefined)
}

export const EventPublisherJob = jest.fn().mockReturnValue(EventPublisher);

export const RetryableListener = class MockRetryableListener {
    constructor (client: any, options: any = {}) {
        this.retryOptions = {
            maxRetries: options?.maxRetries || 3,
            deadLetterMaxRetries: options?.deadLetterMaxRetries || 5,
            enableDeadLetter: options?.enableDeadLetter !== false
        };
    }

    retryOptions: any;
    subject = Subjects.EntityDeleted;
    queueGroupName = 'catalog-service';

    // RetryableListener'ın retry mantığını simüle et
    async onMessage(data: any, msg: any) {
        const eventId = this.getEventId(data);
        const retryKey = `retry:${this.subject}:${eventId}`;

        try {
            // RetryCount kontrol et - await kullanarak
            const retryCountStr = await redisWrapper.client.get(retryKey);
            const retryCount = retryCountStr ? parseInt(retryCountStr, 10) : 0;

            logger.info(`[Mock] Processing event ${this.subject}:${eventId}, retry count: ${retryCount}`);

            if (retryCount >= this.retryOptions.maxRetries) {
                // Max retry aşıldı, ack gönder ve dead letter'a ekle
                msg.ack();
                if (this.retryOptions.enableDeadLetter) {
                    logger.info(`[Mock] Moving to dead letter queue: ${this.subject}:${eventId}`);
                }
                return;
            }

            // İşlemi çalıştır
            await this.processEvent(data);

            logger.info(`[Mock] Event processed successfully: ${this.subject}:${eventId}`);
            // Başarılı, retry sayacını sıfırla
            await redisWrapper.client.del(retryKey);
            msg.ack();
        } catch (error) {
            // Hata durumunda retry sayacını artır
            const retryCountStr = await redisWrapper.client.get(retryKey);
            const retryCount = retryCountStr ? parseInt(retryCountStr, 10) : 0;
            const newCount = retryCount + 1;

            logger.info(`[Mock] Retry attempt ${newCount} for ${this.subject}:${eventId}`);

            logger.info(`[Debug] Redis set çağrısı yapılıyor, key: ${retryKey}, value: ${newCount}`);
            await redisWrapper.client.set(retryKey, newCount.toString());
            logger.info('[Debug] Redis set çağrısı tamamlandı');

            // Max retry aşıldıysa ack ve dead letter
            if (newCount >= this.retryOptions.maxRetries) {
                msg.ack();
                if (this.retryOptions.enableDeadLetter) {
                    logger.info(`[Mock] Moving to dead letter queue after max retries: ${this.subject}:${eventId}`);
                }
            }
            // Değilse hatayı fırlat, test içinde yakalanacak
            else {
                throw error;
            }
        }
    }

    // Alt sınıflar tarafından override edilecek
    async processEvent(data: any) {
        // Boş implementasyon
    }

    // Alt sınıflar tarafından override edilecek
    getEventId(data: any): string {
        return 'mock-id';
    }
}