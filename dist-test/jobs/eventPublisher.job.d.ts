import mongoose from 'mongoose';
import { Stan } from 'node-nats-streaming';
export declare class EventPublisherJob {
    private natsClient;
    private connection;
    private static readonly RETRY_INTERVAL;
    private static readonly ALERT_THRESHOLD;
    private intervalId;
    private monitoringId;
    private readonly outboxModel;
    constructor(natsClient: Stan, connection: mongoose.Connection);
    start(): Promise<void>;
    stop(): void;
    private processEvents;
    private monitorFailedEvents;
    private publishEvent;
}
//# sourceMappingURL=eventPublisher.job.d.ts.map