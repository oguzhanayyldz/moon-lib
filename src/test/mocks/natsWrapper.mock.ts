export const mockNatsWrapper = {
    client: {
        publish: jest.fn().mockImplementation(
            (subject: string, data: string, callback: () => void) => {
                callback();
                return Promise.resolve();
            }
        ),
        subscribe: jest.fn().mockImplementation(() => {
            return {
                on: jest.fn(),
                close: jest.fn()
            };
        })
    }
};

export class MockNatsWrapper {
    constructor () {
        return mockNatsWrapper;
    }
}