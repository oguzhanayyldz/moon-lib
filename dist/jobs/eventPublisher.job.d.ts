import { Stan } from 'node-nats-streaming';
import mongoose from 'mongoose';
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
