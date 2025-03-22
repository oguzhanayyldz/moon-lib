import { Stan } from 'node-nats-streaming';
export declare class EventPublisherJob {
    private natsClient;
    private static readonly RETRY_INTERVAL;
    private static readonly ALERT_THRESHOLD;
    private intervalId;
    private monitoringId;
    constructor(natsClient: Stan);
    start(): Promise<void>;
    stop(): void;
    private processEvents;
    private monitorFailedEvents;
    private publishEvent;
}
