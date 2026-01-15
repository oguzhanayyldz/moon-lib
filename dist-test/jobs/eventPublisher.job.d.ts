import mongoose from 'mongoose';
import { Stan } from 'node-nats-streaming';
export declare class EventPublisherJob {
    private natsClient;
    private connection;
    private static readonly RETRY_INTERVAL;
    private static readonly VERSION_EVENT_INTERVAL;
    private static readonly ALERT_THRESHOLD;
    private intervalId;
    private versionEventIntervalId;
    private monitoringId;
    private readonly outboxModel;
    constructor(natsClient: Stan, connection: mongoose.Connection);
    start(): Promise<void>;
    stop(): void;
    private processEvents;
    /**
     * EntityVersionUpdated eventlerini biriktirip BULK olarak publish eder
     * Bu metod ayrı bir interval ile çalışır (10 saniye) ve birikmiş version
     * eventlerini tek bir EntityVersionBulkUpdated mesajı olarak gönderir
     */
    private processVersionEventsAsBulk;
    private monitorFailedEvents;
    private publishEvent;
}
//# sourceMappingURL=eventPublisher.job.d.ts.map