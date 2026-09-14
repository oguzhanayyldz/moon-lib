import mongoose from 'mongoose';
import { createDeadLetterModel, DeadLetterDoc } from '../models/deadLetter.schema';
import { Stan } from 'node-nats-streaming';
import { logger } from '../services/logger.service';
import { EventMetrics } from '../metrics/EventMetrics';
import { deadLetterReplayRegistry, DeadLetterReplayResult, DeadLetterReplayTarget } from '../events/deadLetterReplayRegistry';

export class DeadLetterProcessorJob {
    private static readonly PROCESSOR_INTERVAL = 60000; // Her 1 dakikada bir çalış
    private static readonly MAX_RETRY_DELAY = 30 * 60000; // Başarısız oynatmadan sonra en fazla 30 dakika bekle
    private static readonly BUSY_RETRY_DELAY = 60000; // Olay kilitliyse 1 dakika sonra yeniden dene
    private static readonly MAX_REPLAYS_PER_CYCLE = 50; // Bir turda en fazla bu kadar kayıt oynatılır
    private static readonly PROCESSING_TIMEOUT = 10 * 60 * 1000; // Bu süreden uzun süren oynatma takılı sayılır
    private intervalId: NodeJS.Timeout | null = null;
    private stuckCheckIntervalId: NodeJS.Timeout | null = null;
    private running = false;
    private readonly deadLetterModel;

    /**
     * @param natsClient Servislerdeki mevcut çağrıyla uyum için imzada kalır. Hedefli oynatma (issue #648 DLQ-H)
     * NATS'e yayın yapmaz: kaydı, kaydı yazan listener bu süreçte işler.
     */
    constructor (
        natsClient: Stan,
        private connection: mongoose.Connection = mongoose.connection
    ) {
        this.deadLetterModel = createDeadLetterModel(connection);
    }

    /**
     * DLQ oynatmasının kapatma anahtarı. Varsayılan KAPALI: DEAD_LETTER_REPLAY_ENABLED 'true' değilse
     * hiçbir kayıt claim edilmez, kayıtlar bekler ve silinmez.
     */
    private static isReplayEnabled(): boolean {
        return process.env.DEAD_LETTER_REPLAY_ENABLED === 'true';
    }

    start(): void {
        if (this.intervalId) {
            return;
        }

        logger.info(`Dead letter processor job started (replay ${DeadLetterProcessorJob.isReplayEnabled() ? 'enabled' : 'disabled'})`);

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
     * Zamanı gelmiş DLQ kayıtlarını, kaydı yazan listener'a bu süreçte oynat (issue #648 DLQ-H).
     * - Yalnız bu süreçte kayıtlı ve oynatması açık listener'ların kayıtları claim edilir. Başka kuyruk grubunun
     *   kaydı, oynatması kapalı listener'ın kaydı ve listenerKey'i olmayan eski kayıt seçilmez.
     * - Bir tur sürerken yeni tur başlamaz; bir turda en fazla MAX_REPLAYS_PER_CYCLE kayıt işlenir.
     */
    private async processPendingEvents(): Promise<void> {
        if (this.running || !DeadLetterProcessorJob.isReplayEnabled()) {
            return;
        }

        const listenerKeys = deadLetterReplayRegistry.replayableKeys();
        if (listenerKeys.length === 0) {
            return;
        }

        this.running = true;
        try {
            // İşleyiciyi tanımla
            const processorId = process.env.POD_NAME || Math.random().toString(36).substring(2, 15);

            for (let replayed = 0; replayed < DeadLetterProcessorJob.MAX_REPLAYS_PER_CYCLE; replayed++) {
                const event = await this.claimNextEvent(listenerKeys, processorId);
                if (!event) {
                    return;
                }
                await this.processEvent(event);
            }
        } catch (error) {
            // MongoDB "not primary" hatalarını ayır - silent fail
            const mongoError = error as { code?: number; codeName?: string };
            if (mongoError?.code === 10107 || mongoError?.codeName === 'NotWritablePrimary') {
                logger.warn('MongoDB not writable (secondary node detected), skipping this cycle');
                return; // Bir sonraki cycle'da primary'e bağlanırsa dener
            }
            logger.error('Error processing dead letter events:', error);
        } finally {
            this.running = false;
        }
    }

    /**
     * Sıradaki kaydı atomik olarak claim et
     */
    private async claimNextEvent(listenerKeys: string[], processorId: string): Promise<DeadLetterDoc | null> {
        const processingTimeout = new Date(Date.now() - DeadLetterProcessorJob.PROCESSING_TIMEOUT);

        // Sadece bu environment'a ait eventleri al
        const currentEnvironment = process.env.NODE_ENV || 'production';

        return await this.deadLetterModel.findOneAndUpdate(
            {
                environment: currentEnvironment,
                listenerKey: { $in: listenerKeys },
                $or: [
                    // Oynatılmayı bekleyen ve deneme bütçesi dolmamış kayıtlar (issue #648 K-2).
                    // RetryableListener retryCount'a toplam deneme sayısını, maxRetries'a toplam bütçeyi yazar.
                    {
                        status: 'queued',
                        nextRetryAt: { $lte: new Date() },
                        $expr: { $lt: ['$retryCount', '$maxRetries'] }
                    },
                    // Takılı kalmış oynatmalar
                    {
                        status: 'replaying',
                        processingStartedAt: { $lt: processingTimeout }
                    }
                ]
            },
            {
                $set: {
                    status: 'replaying',
                    processorId: processorId,
                    processingStartedAt: new Date()
                }
            },
            {
                sort: { nextRetryAt: 1 },
                new: true
            }
        );
    }

    /**
     * Tek bir dead letter olayını kaydı yazan listener'a oynat ve sonucu aynı kayda yaz
     */
    private async processEvent(event: DeadLetterDoc): Promise<void> {
        const target = event.listenerKey ? deadLetterReplayRegistry.get(event.listenerKey) : undefined;
        if (!target) {
            // Claim yalnız kayıtlı anahtarları seçer; defter bu arada değiştiyse kayıt bütçe tüketmeden geri bırakılır
            logger.warn(`No replay target registered for dead letter event ${event.id}: ${event.listenerKey}`);
            await this.requeue(event, DeadLetterProcessorJob.BUSY_RETRY_DELAY);
            return;
        }

        logger.info(`Replaying dead letter event ${event.id}: ${event.listenerKey}`);

        let result: DeadLetterReplayResult;
        try {
            result = await target.replayDeadLetter(event.data);
        } catch (error) {
            // replayDeadLetter hatayı kendisi sonuca çevirir; beklenmeyen bir hata başarısız deneme sayılır
            logger.error(`Error replaying dead letter event ${event.id}:`, error);
            result = 'failed';
        }

        EventMetrics.eventDlqReplayTotal.inc({
            service: event.service,
            event_type: event.subject,
            queue_group: event.queueGroupName || 'unknown',
            result
        });

        if (result === 'processed') {
            await this.deadLetterModel.updateOne(
                this.claimedBy(event),
                {
                    $set: {
                        status: 'completed',
                        completedAt: new Date()
                    }
                }
            );
            logger.info(`Successfully replayed dead letter event ${event.id}`);
            return;
        }

        if (result === 'busy') {
            // Olay başka bir teslimde işleniyor: deneme bütçesi tüketilmez
            await this.requeue(event, DeadLetterProcessorJob.BUSY_RETRY_DELAY);
            return;
        }

        await this.markReplayFailed(event, target);
    }

    /**
     * Başarısız oynatma aynı kaydın sayacını artırır; bütçe dolunca kayıt `failed` olur ve bir daha oynatılmaz
     */
    private async markReplayFailed(event: DeadLetterDoc, target: DeadLetterReplayTarget): Promise<void> {
        const retryCount = event.retryCount + 1;
        const exhausted = retryCount >= event.maxRetries;
        const delay = Math.min(target.getDeadLetterReplayDelay(retryCount), DeadLetterProcessorJob.MAX_RETRY_DELAY);

        await this.deadLetterModel.updateOne(
            this.claimedBy(event),
            {
                $set: {
                    status: exhausted ? 'failed' : 'queued',
                    nextRetryAt: new Date(Date.now() + delay)
                },
                $inc: { retryCount: 1 },
                $unset: { processorId: 1, processingStartedAt: 1 }
            }
        );

        if (exhausted) {
            logger.error(`Dead letter event ${event.id} permanently failed after ${retryCount} attempts: ${event.listenerKey}`);
        }
    }

    /**
     * Kaydı sayacını artırmadan yeniden kuyruğa al
     */
    private async requeue(event: DeadLetterDoc, delay: number): Promise<void> {
        await this.deadLetterModel.updateOne(
            this.claimedBy(event),
            {
                $set: {
                    status: 'queued',
                    nextRetryAt: new Date(Date.now() + delay)
                },
                $unset: { processorId: 1, processingStartedAt: 1 }
            }
        );
    }

    /**
     * Kayıt hâlâ bu işleyicide mi: takılı sayılıp başka işleyiciye geçen kayda dokunulmaz
     */
    private claimedBy(event: DeadLetterDoc) {
        return {
            _id: event.id,
            status: 'replaying',
            processorId: event.processorId
        };
    }

    /**
     * Takılı kalan işlemleri serbest bırak ve bu süreçte oynatıcısı olmayan bekleyen kayıtları logla
     */
    private async releaseStuckEvents(): Promise<void> {
        const stuckTimeout = new Date(Date.now() - DeadLetterProcessorJob.PROCESSING_TIMEOUT);
        const currentEnvironment = process.env.NODE_ENV || 'production';

        const result = await this.deadLetterModel.updateMany(
            {
                environment: currentEnvironment,
                status: 'replaying',
                processingStartedAt: { $lt: stuckTimeout }
            },
            {
                $set: { status: 'queued' },
                $unset: { processorId: 1, processingStartedAt: 1 }
            }
        );

        // DLQ-H öncesi işlemcinin takılı bıraktığı kayıtlar eskisi gibi pending'e döner; bu işlemci pending seçmez
        const legacyResult = await this.deadLetterModel.updateMany(
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

        const released = result.modifiedCount + legacyResult.modifiedCount;
        if (released > 0) {
            logger.info(`Released ${released} stuck dead letter events`);
        }

        // Kaydı yazan listener bu süreçte başlatılmadıysa (kaldırıldı ya da kuyruk grubu değişti) kayıt hiç oynatılmaz
        const unmatched = await this.deadLetterModel.countDocuments({
            environment: currentEnvironment,
            status: 'queued',
            listenerKey: { $nin: deadLetterReplayRegistry.registeredKeys() }
        });
        if (unmatched > 0) {
            logger.warn(`${unmatched} queued dead letter events have no listener registered in this process and will not be replayed`);
        }
    }
}
