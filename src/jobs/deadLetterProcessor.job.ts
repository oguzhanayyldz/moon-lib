import mongoose from 'mongoose';
import { createDeadLetterModel, DeadLetterDoc } from '../models/deadLetter.schema';
import { Stan } from 'node-nats-streaming';
import { logger } from '../services/logger.service';

export class DeadLetterProcessorJob {
    private static readonly PROCESSOR_INTERVAL = 60000; // Her 1 dakikada bir çalış
    private intervalId: NodeJS.Timeout | null = null;
    private readonly deadLetterModel;

    constructor (
        private natsClient: Stan,
        private connection: mongoose.Connection = mongoose.connection
    ) {
        this.deadLetterModel = createDeadLetterModel(connection);
    }

    start(): void {
        if (this.intervalId) {
            return;
        }

        logger.info('Dead letter processor job started');

        // İlk kez hemen çalıştır
        this.processPendingEvents().catch(error => {
            logger.error('Dead letter processor error:', error);
        });

        // Düzenli aralıklarla çalıştır
        this.intervalId = setInterval(async () => {
            try {
                await this.processPendingEvents();
            } catch (error) {
                logger.error('Dead letter processor error:', error);
            }
        }, DeadLetterProcessorJob.PROCESSOR_INTERVAL);
    }

    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            logger.info('Dead letter processor job stopped');
        }
    }

    /**
     * Bekleyen dead letter olaylarını işle
     */
    private async processPendingEvents(): Promise<void> {
        // İşlenecek olayları bul
        const pendingEvents = await this.deadLetterModel.find({
            status: 'pending',
            nextRetryAt: { $lte: new Date() },
            retryCount: { $lt: 5 }
        }).sort({ nextRetryAt: 1 }).limit(10);

        if (pendingEvents.length === 0) {
            return;
        }

        logger.info(`Found ${pendingEvents.length} pending dead letter events`);

        for (const event of pendingEvents) {
            await this.processEvent(event);
        }
    }

    /**
     * Tek bir dead letter olayını işle
     */
    private async processEvent(event: DeadLetterDoc): Promise<void> {
        try {
            // İşleme durumuna ayarla
            event.status = 'processing';
            await event.save();

            logger.info(`Processing dead letter event ${event.id}: ${event.subject}`);

            // NATS'e geri yayınla
            await this.publishToNats(event.subject, event.data);

            // Başarılı olarak işaretle
            event.status = 'completed';
            await event.save();

            logger.info(`Successfully processed dead letter event ${event.id}`);
        } catch (error) {
            logger.error(`Error processing dead letter event ${event.id}:`, error);

            // Retry sayısını artır
            event.retryCount += 1;

            if (event.retryCount >= event.maxRetries) {
                event.status = 'failed';
                logger.error(`Dead letter event ${event.id} permanently failed after ${event.retryCount} attempts`);
            } else {
                event.status = 'pending';

                // Exponential backoff ile bir sonraki denemeyi planla
                const backoffMinutes = Math.pow(2, event.retryCount);
                event.nextRetryAt = new Date(Date.now() + backoffMinutes * 60000);
                logger.info(`Rescheduled dead letter event ${event.id} for retry in ${backoffMinutes} minutes`);
            }

            await event.save();
        }
    }

    /**
     * NATS'e olay yayınla
     */
    private async publishToNats(subject: string, data: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.natsClient.publish(subject, JSON.stringify(data), (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
}