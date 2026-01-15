import mongoose from 'mongoose';
import { Stan } from 'node-nats-streaming';
import { ServiceName } from '../common/';
export declare class EventPublisherJob {
    private natsClient;
    private connection;
    private static readonly RETRY_INTERVAL;
    private static readonly VERSION_EVENT_INTERVAL;
    private static readonly ALERT_THRESHOLD;
    private static readonly MAX_JITTER;
    private static readonly PRIORITY_TRANSITION_DELAY;
    private intervalId;
    private versionEventIntervalId;
    private monitoringId;
    private readonly outboxModel;
    private readonly serviceOffset;
    private lastProcessedPriority;
    constructor(natsClient: Stan, connection: mongoose.Connection, serviceName?: ServiceName);
    /**
     * Environment variable'dan servis adını çöz
     */
    private resolveServiceNameFromEnv;
    /**
     * Servis adından deterministik offset hesapla
     * Bu sayede farklı servisler farklı zamanlarda çalışır (thundering herd prevention)
     */
    private calculateServiceOffset;
    /**
     * Random jitter ekle (0-500ms)
     * Bu sayede aynı servisin farklı pod'ları bile aynı anda çalışmaz
     */
    private getJitter;
    start(): Promise<void>;
    stop(): void;
    private processEvents;
    /**
     * Event batch'ini işle
     */
    private processEventBatch;
    /**
     * EntityVersionUpdated eventlerini biriktirip BULK olarak publish eder
     * Bu metod ayrı bir interval ile çalışır (10 saniye) ve birikmiş version
     * eventlerini tek bir EntityVersionBulkUpdated mesajı olarak gönderir
     */
    private processVersionEventsAsBulk;
    private monitorFailedEvents;
    private publishEvent;
}
