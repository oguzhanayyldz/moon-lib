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
    /**
     * E11000'den sonra processEvent'in süreç içinde kaç kez yeniden koşulacağı (UC-1020). 0 = eski davranış: ilk E11000'de ack.
     * E11000, çakışan yazımın kaydı ZATEN yazdığını söyler: yarışta (iki olay aynı benzersiz kaydı findOne→save ile oluşturuyor)
     * yeniden koşum o kaydı bulur ve başarılı olur; gerçek çiftte E11000 tekrarlanır ve mesaj eskisi gibi ack'lenir.
     * Verilmezse RETRYABLE_DUPLICATE_KEY_RETRIES ortam değişkeni (0–5), o da yoksa 0.
     */
    duplicateKeyRetries?: number;
    /**
     * Olay kilidinin işlem sürdükçe kaç ms'de bir yenileneceği (UC-1020). 0 = yenileme yok (eski davranış).
     * lockTimeoutSec'ten kısa olmalı; uzun işlerde kilidin işin ortasında düşüp yeniden teslimin işi kopyalamasını önler.
     */
    lockRenewIntervalMs?: number;
    /**
     * Kalıcı hatada (isPermanentError) NATS yeniden denemesini atla: ilk denemede 'failed' DLQ kaydı + ack (UC-1043).
     * false = eski davranış: maxRetries kez yeniden teslim, sonra 'queued' DLQ; kalıcı hata yalnız
     * event_permanent_error_total{outcome="shadow"} olarak sayılır (gölge mod).
     * Verilmezse RETRYABLE_PERMANENT_FAIL_FAST ('true' ya da '1'), o da yoksa false.
     */
    failFastOnPermanentError?: boolean;
}
/**
 * RETRYABLE_DUPLICATE_KEY_RETRIES'ı okur; geçersiz ya da yoksa 0, üst sınır MAX_DUPLICATE_KEY_RETRIES.
 */
export declare function resolveDuplicateKeyRetries(explicit?: number): number;
/**
 * RETRYABLE_PERMANENT_FAIL_FAST'ı okur: yalnız 'true' ya da '1' açar; başka her değer kapalı.
 */
export declare function resolveFailFastOnPermanentError(explicit?: boolean): boolean;
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
    protected processWithLock<R>(eventId: string, callback: () => Promise<R>, payloadFingerprint?: string, deliverySequence?: number): Promise<R>;
    /**
     * Kilit değerinin sahip adından sonraki kısmı: `@<sıra>#<parmak izi>`, sıra yoksa `#<parmak izi>`, parmak izi yoksa boş.
     * Kilidi uzatan alt sınıflar (heartbeat) beklenen değeri bununla kurar.
     */
    protected static lockValueSuffix(payloadFingerprint?: string, deliverySequence?: number): string;
    /**
     * Mesajın NATS sıra numarası; yeniden teslimde değişmez. Alınamazsa undefined.
     */
    private getDeliverySequence;
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
     * DLQ kaydını yazar (enableDeadLetter açıksa) ve mesajı ack'ler. `permanent` ise kayıt oynatılmayan 'failed' yazılır.
     * Kayıt yazılamazsa ack'lenmez, NATS yeniden teslim eder; kalıcı olan şema doğrulaması hatası loglanıp ack'lenir.
     */
    private deadLetterAndAck;
    /**
     * Hata aynı veriyle yeniden denemede de değişmez mi (UC-1043)? Servis düzeyi sınıflamayla aynı ad listesi
     * (isDeterministicEventError; shipment UC-1023, orders UC-1013, invoice UC-1025). Alt sınıf genişletebilir.
     * isTransientError KULLANILMAZ: bilinmeyen hatayı ve 'not found' metnini kalıcı sayar; oysa sıra dışı gelen
     * olaylar (ör. güncelleme, oluşturmadan önce) "bulunamadı" fırlatır ve yeniden teslimle düzelir.
     */
    protected isPermanentError(error: unknown): boolean;
    /** Gölge mod: kalıcı sayılan olayı sayar ve işaretler; sonraki teslimde başarı yanlış pozitif sayılır. Redis hatası yutulur. */
    private markPermanentShadow;
    /**
     * Yeniden teslimde (ya da DLQ oynatmasında, `msg` yok) başarı: olay önceden kalıcı sayıldıysa 'recovered' sayılır —
     * fail-fast açık olsaydı bu olay kaybolurdu. Faz 2'de (açma kararı) bu sayacın sıfır kalması aranır. Redis hatası yutulur.
     */
    private recordPermanentShadowRecovery;
    /**
     * processEvent'i koşar; E11000'de en fazla duplicateKeyRetries kez süreç içinde yeniden koşar (UC-1020).
     * Yarış: çakışan yazım kaydı oluşturmuştur, yeniden koşumda handler'ın findOne'ı onu bulur → başarı ('resolved').
     * Gerçek çift: E11000 her koşumda tekrarlar → son hata fırlatılır, çağıran eskisi gibi ack'ler.
     * E11000 dışındaki hatalar hiç yeniden koşulmadan fırlatılır (NATS yeniden denemesi ve DLQ yolu değişmez).
     */
    private processEventWithDuplicateKeyRetries;
    /**
     * Anlık tekrar denemelerle işlemi gerçekleştir
     */
    private processWithImmediateRetries;
    /**
     * DLQ kaydını bu süreçte, bu listener'ın işleme yoluyla bir kez daha işler (issue #648 DLQ-H).
     * NATS'e yayın yapmaz, mesaj ack'lemez ve yeni DLQ kaydı yazmaz; kaydı DeadLetterProcessorJob günceller.
     * - `processed`: işlendi. Duplicate key hatası da canlı yoldaki gibi işlenmiş sayılır.
     * - `busy`: işleme başlayamadı (olay kilitli ya da kilit alınamadı); deneme bütçesi tüketilmez. DeadLetterProcessorJob
     *   zaman sınırını aşan oynatmayı da, işleme başlamış olsa bile, `busy` sayar.
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
     * Olay içeriğinin parmak izi. Aynı eventId altında kopya teslimi farklı olaydan ayırmak için kilit değerine yazılır.
     */
    private getPayloadFingerprint;
    /**
     * İzleme için span oluştur
     */
    protected createTraceSpan(eventType: string, eventId: string): any;
    /**
     * Alt sınıflar tarafından uygulanması gereken asıl olay işleme metodu
     */
    protected abstract processEvent(data: T['data']): Promise<void>;
    /**
     * Hata nesnesinden HTTP durum kodunu çıkarır. Kod bulunamazsa 0 döner.
     *
     * Aday sırası kasıtlıdır:
     * - `response.status`: axios ve fetch benzeri istemcilerde HTTP kodunun TEK güvenilir yeri.
     * - `statusCode`: moon `CustomError` ailesi (`BadRequestError` 400, `ConflictError` 409,
     *   `LockedError` 423, `RateLimit` 429, `DatabaseConnectionError` 500 …) ve Node http.
     * - `status`: axios'a yalnız 1.8'de eklendi; depodaki semver aralıkları `^1.6.0`'a kadar
     *   iniyor, bu yüzden tek başına güvenilmez — yedek adaydır.
     *
     * `error.code` KASITLI OLARAK okunmaz: axios'ta STRING bir tanımlayıcıdır
     * (`'ERR_BAD_REQUEST'`, `'ECONNREFUSED'`), MongoDB'de ise HTTP dışı bir sayıdır (11000).
     * Eskiden durum kodu adayıydı ve string değeri sayısal karşılaştırmalara sokuluyordu;
     * JS'te `'ERR_BAD_REQUEST' >= 200` daima `false` ürettiği için bu sessizce yanlış sonuç
     * veriyordu. Yalnız 100-599 aralığındaki tam sayılar HTTP kodu sayılır.
     */
    private extractHttpStatusCode;
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
}
export {};
//# sourceMappingURL=retryableListener.d.ts.map