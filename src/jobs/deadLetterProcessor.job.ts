import mongoose from 'mongoose';
import { createDeadLetterModel, DeadLetterDoc } from '../models/deadLetter.schema';
import { Stan } from 'node-nats-streaming';
import { logger } from '../services/logger.service';

export class DeadLetterProcessorJob {
    private static readonly PROCESSOR_INTERVAL = 60000; // Her 1 dakikada bir çalış
    private intervalId: NodeJS.Timeout | null = null;
    private stuckCheckIntervalId: NodeJS.Timeout | null = null;
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

        // 5 dakikada bir takılı kalan işlemleri serbest bırakacak ek timer ekle
        this.stuckCheckIntervalId = setInterval(async () => {
            try {
                await this.releaseStuckEvents();
            } catch (error) {
                logger.error('Error checking stuck events:', error);
            }
        }, 5 * 60 * 1000);
    }

    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            logger.info('Dead letter processor job stopped');
        }

        if (this.stuckCheckIntervalId) {
            clearInterval(this.stuckCheckIntervalId);
            this.stuckCheckIntervalId = null;
        }
    }

    /**
     * Bekleyen dead letter olaylarını işle
     */
    private async processPendingEvents(): Promise<void> {
        try {
            // İşleme süresi (10 dakika)
            const processingTimeout = new Date(Date.now() - 10 * 60 * 1000);

            // İşleyiciyi tanımla
            const processorId = process.env.POD_NAME || Math.random().toString(36).substring(2, 15);

            // Sadece bu environment'a ait eventleri al
            const currentEnvironment = process.env.NODE_ENV || 'production';

            // Bul ve güncelle - atomik işlem
            const event = await this.deadLetterModel.findOneAndUpdate(
                {
                    environment: currentEnvironment,
                    $or: [
                        // Pending durumundaki event'ler
                        {
                            status: 'pending',
                            nextRetryAt: { $lte: new Date() },
                            retryCount: { $lt: 5 }
                        },
                        // Takılı kalmış processing event'ler
                        {
                            status: 'processing',
                            processingStartedAt: { $lt: processingTimeout }
                        }
                    ]
                },
                {
                    $set: {
                        status: 'processing',
                        processorId: processorId,
                        processingStartedAt: new Date()
                    }
                },
                {
                    sort: { nextRetryAt: 1 },
                    new: true
                }
            );
            
            if (!event) {
                return;
            }
            
            // İşle ve yayınla
            await this.processEvent(event);
            
            // Tekrar çağır (batch işleme yerine sırayla)
            await this.processPendingEvents();
        } catch (error: any) {
            // MongoDB "not primary" hatalarını ayır - silent fail
            if (error.code === 10107 || error.codeName === 'NotWritablePrimary') {
                logger.warn('MongoDB not writable (secondary node detected), skipping this cycle');
                return; // Bir sonraki cycle'da primary'e bağlanırsa dener
            }
            logger.error('Error processing dead letter events:', error);
        }
    }

    /**
     * Tek bir dead letter olayını işle
     */
    private async processEvent(event: DeadLetterDoc): Promise<void> {
        try {
            logger.info(`Processing dead letter event ${event.id}: ${event.subject}`);

            // NATS'e geri yayınla
            await this.publishToNats(event.subject, event.data);

            // Başarılı olarak işaretle
            await this.deadLetterModel.updateOne(
                { 
                    _id: event.id, 
                    status: 'processing',
                    processorId: event.processorId 
                },
                { 
                    $set: { 
                        status: 'completed',
                        completedAt: new Date()
                    } 
                }
            );

            logger.info(`Successfully processed dead letter event ${event.id}`);
        } catch (error) {
            logger.error(`Error processing dead letter event ${event.id}:`, error);

            // Takılı kalmaması için atomik güncelle
            const updated = await this.deadLetterModel.findOneAndUpdate(
                { 
                    _id: event.id, 
                    status: 'processing',
                    processorId: event.processorId
                },
                { 
                    $set: { 
                        status: 'pending',
                        nextRetryAt: new Date(Date.now() + Math.pow(2, event.retryCount + 1) * 60000)
                    },
                    $inc: { retryCount: 1 },
                    $unset: { processorId: 1, processingStartedAt: 1 }
                },
                { new: true }
            );
            
            if (updated && updated.retryCount >= updated.maxRetries) {
                await this.deadLetterModel.updateOne(
                    { _id: updated.id },
                    { $set: { status: 'failed' } }
                );
                logger.error(`Dead letter event ${updated.id} permanently failed after ${updated.retryCount} attempts`);
            }
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

    /**
     * Takılı kalan işlemleri serbest bırak
     */
    private async releaseStuckEvents(): Promise<void> {
        const stuckTimeout = new Date(Date.now() - 10 * 60 * 1000); // 10 dakika
        const currentEnvironment = process.env.NODE_ENV || 'production';

        const result = await this.deadLetterModel.updateMany(
            {
                environment: currentEnvironment,
                status: 'processing',
                processingStartedAt: { $lt: stuckTimeout }
            },
            {
                $set: { status: 'pending' },
                $unset: { processorId: 1, processingStartedAt: 1 }
            }
        );
        
        if (result.modifiedCount > 0) {
            logger.info(`Released ${result.modifiedCount} stuck dead letter events`);
        }
    }
}