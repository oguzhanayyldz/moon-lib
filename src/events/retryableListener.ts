import { Message, Stan } from 'node-nats-streaming';
import { Event, Listener, Subjects } from '@xmoonx/common';
import { RetryManager } from '../services/retryManager';
import { createDeadLetterModel } from '../models/deadLetter.schema';
import mongoose from 'mongoose';

interface RetryOptions {
    immediateRetries?: number;
    enableDeadLetter?: boolean;
    maxRetries?: number;
    deadLetterMaxRetries?: number;
}

/**
 * Retry özellikli temel listener sınıfı
 */
export abstract class RetryableListener<T extends Event> extends Listener<T> {
    private retryManager: RetryManager;
    private options: Required<RetryOptions>;

    // Varsayılan seçenekler  
    private static readonly DEFAULT_OPTIONS: Required<RetryOptions> = {
        immediateRetries: 3,      // Anında tekrar deneme sayısı
        enableDeadLetter: true,   // Ölü mektup kuyruğunu etkinleştir
        maxRetries: 5,            // Redis'te izlenen toplam deneme sayısı
        deadLetterMaxRetries: 5   // Ölü mektup kuyruğu için maksimum deneme
    };

    constructor (client: Stan, options: RetryOptions = {}) {
        super(client);
        this.options = { ...RetryableListener.DEFAULT_OPTIONS, ...options };
        this.retryManager = new RetryManager({
            maxRetries: this.options.maxRetries,
            ttlSeconds: 86400, // 24 saat
            backoffFactor: 2
        });
    }

    /**
     * Retry mantığı ile geliştirilmiş mesaj işleme
     */
    async onMessage(data: T['data'], msg: Message): Promise<void> {
        const eventId = this.getEventId(data);
        const eventType = this.subject;
        const span = this.createTraceSpan(eventType, eventId);

        try {
            await this.processEvent(data);
            
            // Başarılı işlemede retry sayacını sıfırla
            await this.retryManager.resetRetryCount(eventType, eventId);
            span.setTag('success', true);
            msg.ack();
        } catch (error) {
            span.setTag('error', true);
            span.setTag('error.message', (error as Error).message);
            console.error(`Error processing ${eventType}:${eventId}:`, error);

            // MongoDB duplicate key hatası kontrolü
            const isDuplicateKeyError = this.isDuplicateKeyError(error);
            
            if (isDuplicateKeyError) {
                // Unique constraint hatası - retry yapmayacağız
                console.log(`Retry atlanıyor - Duplicate key hatası: ${eventType}:${eventId}`);
                span.setTag('error.retry_skipped', true);
                span.setTag('error.duplicate_key', true);
                
                // Mesajı onaylayıp geçiyoruz
                msg.ack();
            } else {
                // Diğer hatalar için normal retry işlemi
                const retryCount = await this.retryManager.incrementRetryCount(eventType, eventId);
                span.setTag('retry.count', retryCount);
                
                // Hala denenmeli mi kontrol et
                if (await this.retryManager.shouldRetry(eventType, eventId)) {
                    console.log(`Redis retry ${retryCount}/${this.options.maxRetries} for ${eventType}:${eventId}`);
                    span.setTag('retry.scheduled', true);
                    // msg.ack() çağırmadan çık. Bu, NATS'in mesajı yeniden göndermesini sağlar.
                } else {
                    console.log(`Max retries (${this.options.maxRetries}) reached for ${eventType}:${eventId}`);
                    
                    if (this.options.enableDeadLetter) {
                        try {
                            await this.moveToDeadLetterQueue(data, error as Error, retryCount);
                            span.setTag('dead_letter.saved', true);
                        } catch (dlqError) {
                            console.error('Failed to save to dead letter queue:', dlqError);
                            span.setTag('dead_letter.error', (dlqError as Error).message);
                        }
                    }
                    
                    msg.ack();
                }
            }
        } finally {
            span.finish();
        }
    }

    /**
     * Anlık tekrar denemelerle işlemi gerçekleştir
     */
    private async processWithImmediateRetries(data: T['data'], msg: Message, span: any): Promise<void> {
        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= this.options.immediateRetries; attempt++) {
            try {
                // Ana işlem metodu
                await this.processEvent(data);
                span.setTag('immediate_retry.success', true);
                span.setTag('immediate_retry.attempt', attempt);
                return; // Başarılı olduğunda hemen dön
            } catch (error) {
                lastError = error as Error;
                span.setTag('immediate_retry.attempt', attempt);

                // Kalıcı bir hata ise hemen yeniden denemeyi bırak
                if (!this.isTransientError(error)) {
                    span.setTag('immediate_retry.permanent_error', true);
                    break;
                }

                // Son deneme değilse kısa bir süre bekle ve tekrar dene
                if (attempt < this.options.immediateRetries) {
                    const delay = Math.pow(2, attempt - 1) * 100; // 100ms, 200ms, 400ms, ...
                    span.setTag('immediate_retry.delay_ms', delay);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // Tüm denemeler başarısız olduysa, son hatayı fırlat
        if (lastError) {
            throw lastError;
        }
    }

    /**
     * İşlenemeyen olayı Dead Letter kuyruğuna taşı
     */
    private async moveToDeadLetterQueue(data: T['data'], error: Error, retryCount: number): Promise<void> {
        const deadLetterModel = createDeadLetterModel(mongoose.connection);
        const eventId = this.getEventId(data);

        await deadLetterModel.build({
            subject: this.subject,
            eventId: eventId,
            data: data,
            error: error.message,
            retryCount: retryCount,
            maxRetries: this.options.deadLetterMaxRetries,
            service: process.env.SERVICE_NAME || 'unknown',
            nextRetryAt: new Date(Date.now() + 60000), // 1 dakika sonra yeniden dene
            timestamp: new Date()
        }).save();

        console.log(`Event moved to DLQ: ${this.subject}:${eventId}`);
    }

    /**
     * Olaydan benzersiz bir ID çıkar
     * Alt sınıflar tarafından override edilebilir
     */
    protected getEventId(data: T['data']): string {
        // Yaygın ID formatları
        if ((data as any).id) return (data as any).id;
        if ((data as any).list && (data as any).list[0]?.id) return (data as any).list[0].id;

        // Özel ID oluştur (hash benzeri)
        return `${this.subject}-${JSON.stringify(data).slice(0, 50).replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}`;
    }

    /**
     * İzleme için span oluştur
     */
    protected createTraceSpan(eventType: string, eventId: string): any {
        try {
            const { tracer } = require('../../services/tracer');
            const span = tracer.startSpan(`${eventType}-listener`);
            span.setTag('event.type', eventType);
            span.setTag('event.id', eventId);
            return span;
        } catch (error) {
            // Mock span döndür
            return {
                setTag: () => { },
                finish: () => { }
            };
        }
    }

    /**
     * Alt sınıflar tarafından uygulanması gereken asıl olay işleme metodu
     */
    protected abstract processEvent(data: T['data']): Promise<void>;

    /**
     * Hatanın geçici mi kalıcı mı olduğunu belirler
     */
    protected isTransientError(error: any): boolean {
        const errorMessage = error?.message?.toLowerCase() || '';
        return (
            errorMessage.includes('connection') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('network') ||
            errorMessage.includes('econnrefused') ||
            errorMessage.includes('econnreset') ||
            errorMessage.includes('unavailable') ||
            errorMessage.includes('temporarily')
        );
    }

    /**
     * MongoDB duplicate key hatası olup olmadığını kontrol eder
     */
    private isDuplicateKeyError(error: unknown): boolean {
        // MongoDB duplicate key hata mesajı kontrolü
        if (error instanceof Error) {
            // MongoDB hata kodu 11000 duplicate key hatası
            if (error.name === 'MongoError' && (error as any).code === 11000) {
                return true;
            }
            
            // Hata mesajında duplicate key ifadesi var mı?
            if (error.message.includes('duplicate key') || 
                error.message.includes('E11000') || 
                error.message.includes('duplicate') || 
                error.message.includes('uniqueCode')) {
                return true;
            }
        }
        return false;
    }
}