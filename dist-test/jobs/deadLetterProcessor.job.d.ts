import mongoose from 'mongoose';
import { Stan } from 'node-nats-streaming';
export declare class DeadLetterProcessorJob {
    private natsClient;
    private connection;
    private static readonly PROCESSOR_INTERVAL;
    private intervalId;
    private stuckCheckIntervalId;
    private readonly deadLetterModel;
    constructor(natsClient: Stan, connection?: mongoose.Connection);
    start(): void;
    stop(): void;
    /**
     * Bekleyen dead letter olaylarını işle
     */
    private processPendingEvents;
    /**
     * Tek bir dead letter olayını işle
     */
    private processEvent;
    /**
     * NATS'e olay yayınla
     */
    private publishToNats;
    /**
     * Takılı kalan işlemleri serbest bırak
     */
    private releaseStuckEvents;
}
//# sourceMappingURL=deadLetterProcessor.job.d.ts.map