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

// Tracer - Test-friendly version
export const createTracer = (config: any) => ({
  startSpan: jest.fn(() => ({
    setTag: jest.fn().mockReturnThis(),
    finish: jest.fn(),
    log: jest.fn().mockReturnThis(),
    setOperationName: jest.fn().mockReturnThis()
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
      set: jest.fn((key: string, value: any) => {
        mockStorage[key] = value;
        return Promise.resolve('OK');
      }),
      get: jest.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
      del: jest.fn((key: string) => {
        delete mockStorage[key];
        return Promise.resolve(1);
      }),
      hGetAll: jest.fn().mockResolvedValue({}),
      quit: jest.fn().mockResolvedValue(undefined)
    },
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined)
  };
};
