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
     * İşlenemeyen olayı Dead Letter kuyruğuna taşı. Kayıt yazılamazsa hata fırlatır; çağıran mesajı ack'lemez
     * (kalıcı olan şema doğrulaması hatası hariç: o durumda hata loglanıp mesaj ack'lenir).
     *
     * Deneme bütçesi (issue #648 K-2): `retryCount` bu olayın toplam başarısız deneme sayısıdır (Redis sayacı),
     * `maxRetries` ise NATS denemeleri + DLQ oynatmaları toplamıdır. Sayaç yalnız başarıda sıfırlandığı için
     * DLQ'dan oynatılan mesaj yine başarısız olursa sayaç büyümeye devam eder; bütçe dolunca kayıt `failed`
     * yazılır ve bir daha oynatılmaz. Böylece hiç işlenemeyen bir mesaj DLQ → NATS döngüsüne girmez.
     */
    private moveToDeadLetterQueue;
    /**
     * DLQ oynatmaları arasındaki bekleme: 1, 2, 4, 8, 16 dk ... (üst sınır 30 dk)
     */
    private getDeadLetterReplayDelay;
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
     * Hatanın metnini döndürür. Mesajsız Error ya da Error olmayan bir throw için de boş olmayan metin üretir:
     * DeadLetter şemasında `error` zorunlu alandır ve boş metin kaydı geçersiz kılar.
     */
    private describeError;
    /**
     * MongoDB duplicate key hatası olup olmadığını kontrol eder
     */
    private isDuplicateKeyError;
}
export {};
//# sourceMappingURL=retryableListener.d.ts.map