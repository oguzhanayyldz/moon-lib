import { Subjects } from './index';
export * from './index';
export declare const createNatsWrapper: () => {
    client: {
        publish: jest.Mock<string, [subject: string, data: any, callback?: (() => void) | undefined], any>;
        subscribe: jest.Mock<{
            on: jest.Mock<any, any, any>;
            unsubscribe: jest.Mock<any, any, any>;
            setManualAckMode: jest.Mock<any, any, any>;
            setAckWait: jest.Mock<any, any, any>;
            setDurableName: jest.Mock<any, any, any>;
            setDeliverAllAvailable: jest.Mock<any, any, any>;
            setMaxInFlight: jest.Mock<any, any, any>;
            setStartWithLastReceived: jest.Mock<any, any, any>;
            setStartAtSequence: jest.Mock<any, any, any>;
            setStartTime: jest.Mock<any, any, any>;
            setStartAtTimeDelta: jest.Mock<any, any, any>;
            close: jest.Mock<any, any, any>;
        }, [], any>;
        subscriptionOptions: jest.Mock<{
            setManualAckMode: jest.Mock<any, any, any>;
            setAckWait: jest.Mock<any, any, any>;
            setDurableName: jest.Mock<any, any, any>;
            setDeliverAllAvailable: jest.Mock<any, any, any>;
        }, [], any>;
        close: jest.Mock<any, any, any>;
        addListener: jest.Mock<any, any, any>;
        on: jest.Mock<any, any, any>;
        once: jest.Mock<any, any, any>;
        prependListener: jest.Mock<any, any, any>;
        prependOnceListener: jest.Mock<any, any, any>;
        removeListener: jest.Mock<any, any, any>;
        off: jest.Mock<any, any, any>;
        removeAllListeners: jest.Mock<any, any, any>;
        setMaxListeners: jest.Mock<any, any, any>;
        getMaxListeners: jest.Mock<any, any, any>;
        listeners: jest.Mock<any, any, any>;
        rawListeners: jest.Mock<any, any, any>;
        emit: jest.Mock<any, any, any>;
        eventNames: jest.Mock<any, any, any>;
        listenerCount: jest.Mock<any, any, any>;
    };
    connect: jest.Mock<any, any, any>;
};
export declare const createTracer: (config: any) => {
    startSpan: jest.Mock<{
        setTag: jest.Mock<any, any, any>;
        finish: jest.Mock<any, any, any>;
        log: jest.Mock<any, any, any>;
        setOperationName: jest.Mock<any, any, any>;
        context: jest.Mock<any, any, any>;
        tracer: jest.Mock<any, any, any>;
        setBaggageItem: jest.Mock<any, any, any>;
        getBaggageItem: jest.Mock<any, any, any>;
        addTags: jest.Mock<any, any, any>;
        setTags: jest.Mock<any, any, any>;
        addReference: jest.Mock<any, any, any>;
        followsFrom: jest.Mock<any, any, any>;
        childOf: jest.Mock<any, any, any>;
        logEvent: jest.Mock<any, any, any>;
        logFields: jest.Mock<any, any, any>;
        uuid: jest.Mock<any, any, any>;
        operationName: jest.Mock<any, any, any>;
        startTime: jest.Mock<any, any, any>;
    }, [], any>;
    inject: jest.Mock<any, any, any>;
    extract: jest.Mock<any, any, any>;
    close: jest.Mock<any, any, any>;
};
export declare const createRedisWrapper: () => {
    client: {
        set: jest.Mock<Promise<string>, [key: string, value: any, options?: any], any>;
        get: jest.Mock<Promise<any>, [key: string], any>;
        del: jest.Mock<Promise<number>, [key: string | string[]], any>;
        incr: jest.Mock<Promise<number>, [key: string], any>;
        expire: jest.Mock<Promise<number>, [key: string, seconds: number], any>;
        scan: jest.Mock<Promise<{
            cursor: number;
            keys: string[];
        }>, [cursor: number, options?: any], any>;
        lPush: jest.Mock<Promise<any>, [key: string, value: string], any>;
        lLen: jest.Mock<Promise<number>, [key: string], any>;
        hSet: jest.Mock<Promise<number>, [key: string, field: string, value: any], any>;
        hGet: jest.Mock<Promise<any>, [key: string, field: string], any>;
        hGetAll: jest.Mock<Promise<any>, [key: string], any>;
        hDel: jest.Mock<Promise<number>, [key: string, field: string], any>;
        lTrim: jest.Mock<Promise<string>, [key: string, start: number, stop: number], any>;
        lRange: jest.Mock<Promise<any[]>, [key: string, start: number, stop: number], any>;
        quit: jest.Mock<any, any, any>;
        on: jest.Mock<void, [event: string, handler: Function], any>;
    };
    connect: jest.Mock<any, any, any>;
    disconnect: jest.Mock<any, any, any>;
    getOrder: jest.Mock<any, any, any>;
    setOrder: jest.Mock<any, any, any>;
    delOrder: jest.Mock<any, any, any>;
};
export declare const redisWrapper: {
    client: {
        set: jest.Mock<Promise<string>, [key: string, value: any, options?: any], any>;
        get: jest.Mock<Promise<any>, [key: string], any>;
        del: jest.Mock<Promise<number>, [key: string | string[]], any>;
        incr: jest.Mock<Promise<number>, [key: string], any>;
        expire: jest.Mock<Promise<number>, [key: string, seconds: number], any>;
        scan: jest.Mock<Promise<{
            cursor: number;
            keys: string[];
        }>, [cursor: number, options?: any], any>;
        lPush: jest.Mock<Promise<any>, [key: string, value: string], any>;
        lLen: jest.Mock<Promise<number>, [key: string], any>;
        hSet: jest.Mock<Promise<number>, [key: string, field: string, value: any], any>;
        hGet: jest.Mock<Promise<any>, [key: string, field: string], any>;
        hGetAll: jest.Mock<Promise<any>, [key: string], any>;
        hDel: jest.Mock<Promise<number>, [key: string, field: string], any>;
        lTrim: jest.Mock<Promise<string>, [key: string, start: number, stop: number], any>;
        lRange: jest.Mock<Promise<any[]>, [key: string, start: number, stop: number], any>;
        quit: jest.Mock<any, any, any>;
        on: jest.Mock<void, [event: string, handler: Function], any>;
    };
    connect: jest.Mock<any, any, any>;
    disconnect: jest.Mock<any, any, any>;
    getOrder: jest.Mock<any, any, any>;
    setOrder: jest.Mock<any, any, any>;
    delOrder: jest.Mock<any, any, any>;
};
export declare const tracer: {
    startSpan: jest.Mock<any, any, any>;
    inject: jest.Mock<any, any, any>;
    getMockSpan: jest.Mock<any, any, any>;
    clearMock: jest.Mock<any, any, any>;
};
export declare const natsWrapper: {
    client: {
        publish: jest.Mock<any, any, any>;
        close: jest.Mock<any, any, any>;
        subscribe: jest.Mock<any, any, any>;
        subscriptionOptions: jest.Mock<any, any, any>;
        on: jest.Mock<any, any, any>;
        off: jest.Mock<any, any, any>;
        once: jest.Mock<any, any, any>;
        prependListener: jest.Mock<any, any, any>;
        prependOnceListener: jest.Mock<any, any, any>;
        removeListener: jest.Mock<any, any, any>;
        removeAllListeners: jest.Mock<any, any, any>;
        setMaxListeners: jest.Mock<any, any, any>;
        getMaxListeners: jest.Mock<any, any, any>;
        listeners: jest.Mock<any, any, any>;
        rawListeners: jest.Mock<any, any, any>;
        emit: jest.Mock<any, any, any>;
        eventNames: jest.Mock<any, any, any>;
        listenerCount: jest.Mock<any, any, any>;
        addListener: jest.Mock<any, any, any>;
    };
    connect: jest.Mock<any, any, any>;
    isConnected: jest.Mock<any, any, any>;
};
export declare const logger: {
    info: jest.Mock<any, any, any>;
    error: jest.Mock<any, any, any>;
    warn: jest.Mock<any, any, any>;
    debug: jest.Mock<any, any, any>;
    verbose: jest.Mock<any, any, any>;
};
export declare const OptimisticLockingUtil: {
    saveWithRetry: jest.Mock<any, any, any>;
    updateWithRetry: jest.Mock<any, any, any>;
    retryWithOptimisticLocking: jest.Mock<any, any, any>;
};
export declare const EventPublisher: {
    start: jest.Mock<any, any, any>;
    stop: jest.Mock<any, any, any>;
    processEvents: jest.Mock<any, any, any>;
    monitorFailedEvents: jest.Mock<any, any, any>;
    publishEvent: jest.Mock<any, any, any>;
};
export declare const EventPublisherJob: jest.Mock<any, any, any>;
export declare const RetryableListener: {
    new (client: any, options?: any): {
        retryOptions: any;
        subject: Subjects;
        queueGroupName: string;
        onMessage(data: any, msg: any): Promise<void>;
        processEvent(data: any): Promise<void>;
        getEventId(data: any): string;
    };
};
export declare const createOutboxModel: jest.Mock<{
    build: jest.Mock<any, any, any>;
    create: jest.Mock<any, any, any>;
    findById: jest.Mock<any, any, any>;
    findByIdAndUpdate: jest.Mock<any, any, any>;
    findOne: jest.Mock<any, any, any>;
    find: jest.Mock<any, any, any>;
    deleteOne: jest.Mock<any, any, any>;
    updateOne: jest.Mock<any, any, any>;
}, [], any>;
export declare const createOutboxMock: () => {
    Outbox: jest.Mock<any, any, any>;
};
export declare const setupTestEnvironment: () => void;
export declare const expectOutboxEventCreated: (mockOutboxConstructor: any, expectedEventType: string, expectedPayloadProps?: any) => void;
export declare const expectOptimisticLockingSaved: (times?: number) => void;
export declare const commonTestPatterns: {
    expectEventPublished: (mockOutboxConstructor: any, eventType: string, payloadCheck?: any) => void;
    expectUnauthorized: (response: any) => void;
    expectNotFound: (response: any) => void;
    expectBadRequest: (response: any) => void;
    expectSuccess: (response: any, expectedStatus?: number) => void;
};
export declare const SecurityValidator: jest.Mock<any, any, any>;
export declare const RateLimiter: jest.Mock<any, any, any>;
export declare const BruteForceProtection: jest.Mock<any, any, any>;
export declare const SecurityHeaders: jest.Mock<any, any, any>;
export declare const SecurityManager: jest.Mock<any, any, any>;
export declare const createSecurityValidator: jest.Mock<any, any, any>;
export declare const createRateLimiter: jest.Mock<any, any, any>;
export declare const createBruteForceProtection: jest.Mock<any, any, any>;
export declare const createSecurityHeaders: jest.Mock<any, any, any>;
export declare const createSecurityManager: jest.Mock<any, any, any>;
//# sourceMappingURL=index.test.d.ts.map