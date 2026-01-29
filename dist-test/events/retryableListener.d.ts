import { Message, Stan } from 'node-nats-streaming';
import { Event, Listener } from '../common';
import mongoose from 'mongoose';
interface RetryOptions {
    immediateRetries?: number;
    enableDeadLetter?: boolean;
    maxRetries?: number;
    deadLetterMaxRetries?: number;
    lockTimeoutSec?: number;
    enableLock?: boolean;
    ackWaitSec?: number;
}
/**
 * Retry özellikli temel listener sınıfı
 */
export declare abstract class RetryableListener<T extends Event> extends Listener<T> {
    private retryManager;
    private options;
    private connection;
    private static readonly DEFAULT_OPTIONS;
    constructor(client: Stan, options?: RetryOptions, connection?: mongoose.Connection);
    /**
     * Distributed lock ile işlem yapmak için yardımcı metod
     */
    protected processWithLock<R>(eventId: string, callback: () => Promise<R>): Promise<R>;
    /**
     * Redis'te lock almaya çalışır
     */
    private tryAcquireLock;
    /**
     * Redis'teki lock'ı kaldırır (sadece kendimizin oluşturduğu kilidi)
     */
    private releaseLock;
    /**
     * Retry mantığı ile geliştirilmiş mesaj işleme
     */
    onMessage(data: T['data'], msg: Message): Promise<void>;
    /**
     * Anlık tekrar denemelerle işlemi gerçekleştir
     */
    private processWithImmediateRetries;
    /**
     * İşlenemeyen olayı Dead Letter kuyruğuna taşı
     */
    private moveToDeadLetterQueue;
    /**
     * Olaydan benzersiz bir ID çıkar
     * Alt sınıflar tarafından override edilebilir
     */
    protected getEventId(data: T['data']): string;
    /**
     * İzleme için span oluştur
     */
    protected createTraceSpan(eventType: string, eventId: string): any;
    /**
     * Alt sınıflar tarafından uygulanması gereken asıl olay işleme metodu
     */
    protected abstract processEvent(data: T['data']): Promise<void>;
    /**
 * Hatanın geçici mi kalıcı mı olduğunu belirler
 * Geçici hatalar için retry yapılmalı, kalıcı hatalar için yapılmamalı
 */
    protected isTransientError(error: any): boolean;
    /**
     * MongoDB duplicate key hatası olup olmadığını kontrol eder
     */
    private isDuplicateKeyError;
}
export {};
//# sourceMappingURL=retryableListener.d.ts.map