export const mockEventPublisherJob = {
    start: jest.fn().mockImplementation(() => Promise.resolve()),
    stop: jest.fn(),
    processEvents: jest.fn().mockImplementation(() => Promise.resolve()),
    monitorFailedEvents: jest.fn().mockImplementation(() => Promise.resolve()),
    publishEvent: jest.fn().mockImplementation(() => Promise.resolve())
};

export class MockEventPublisherJob {
    constructor () {
        return mockEventPublisherJob;
    }
}