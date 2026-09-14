import { Message, Stan } from 'node-nats-streaming';
import { Event, Listener } from '../common';
import mongoose from 'mongoose';
import { DeadLetterReplayResult } from './deadLetterReplayRegistry';
interface RetryOptions {
    immediateRetries?: number;
    enableDeadLetter?: boolean;
    maxRetries?: number;
    deadLetterMaxRetries?: number;
    lockTimeoutSec?: number;
    enableLock?: boolean;
    ackWaitSec?: number;
    deadLetterReplay?: boolean;
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
     * Aboneliği başlatır ve listener'ı süreç içi DLQ oynatma defterine kaydeder (issue #648 DLQ-H).
     * DeadLetterProcessorJob yalnız bu süreçte kayıtlı ve oynatması açık listener'ların DLQ kayıtlarını oynatır.
     */
    listen(): void;
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
     * DLQ kaydını bu süreçte, bu listener'ın işleme yoluyla bir kez daha işler (issue #648 DLQ-H).
     * NATS'e yayın yapmaz, mesaj ack'lemez ve yeni DLQ kaydı yazmaz; kaydı DeadLetterProcessorJob günceller.
     * - `processed`: işlendi. Duplicate key hatası da canlı yoldaki gibi işlenmiş sayılır.
     * - `busy`: işleme başlayamadı (olay kilitli ya da kilit alınamadı); deneme bütçesi tüketilmez.
     * - `failed`: işleme hata verdi; bütçeden bir deneme düşülür.
     */
    replayDeadLetter(data: T['data']): Promise<DeadLetterReplayResult>;
    /**
     * İşlenemeyen olayı Dead Letter kuyruğuna taşı. Kayıt yazılamazsa hata fırlatır; çağıran mesajı ack'lemez
     * (kalıcı olan şema doğrulaması hatası hariç: o durumda hata loglanıp mesaj ack'lenir).
     *
     * Deneme bütçesi (issue #648 K-2): `retryCount` bu olayın toplam başarısız deneme sayısıdır (Redis sayacı),
     * `maxRetries` ise NATS denemeleri + DLQ oynatmaları toplamıdır. Bütçe dolmuşsa kayıt `failed` yazılır ve oynatılmaz.
     * Oynatılacak kayıt `queued` yazılır ve kaydı yazan listener'ın anahtarını taşır (issue #648 DLQ-H): başarısız bir
     * oynatma yeni kayıt yazmaz, DeadLetterProcessorJob aynı kaydın `retryCount`'unu artırır.
     */
    private moveToDeadLetterQueue;
    /**
     * DLQ oynatmaları arasındaki bekleme: 1, 2, 4, 8, 16 dk ... (üst sınır 30 dk).
     * `retryCount` olayın toplam başarısız deneme sayısıdır; ilk `maxRetries` deneme NATS teslimidir, gerisi oynatmadır.
     */
    getDeadLetterReplayDelay(retryCount: number): number;
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