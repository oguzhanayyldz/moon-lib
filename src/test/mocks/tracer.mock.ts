export const mockTracer = {
    startSpan: jest.fn().mockImplementation(() => ({
        setTag: jest.fn().mockReturnThis(),
        finish: jest.fn().mockReturnThis(),
        log: jest.fn().mockReturnThis()
    })),
    inject: jest.fn(),
    getMockSpan: (index: number = 0) => {
        return (mockTracer.startSpan as jest.Mock).mock.results[index].value;
    },
    clearMock: () => {
        (mockTracer.startSpan as jest.Mock).mockClear();
        (mockTracer.inject as jest.Mock).mockClear();
    }
};

export class MockTracer {
    constructor() {
        return mockTracer;
    }
}