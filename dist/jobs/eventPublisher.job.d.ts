import mongoose from 'mongoose';
import { Stan } from 'node-nats-streaming';
import { ServiceName } from '../common/';
export declare class EventPublisherJob {
    private natsClient;
    private connection;
    private static readonly RETRY_INTERVAL;
    private static readonly VERSION_EVENT_INTERVAL_DEFAULT;
    private static readonly VERSION_BATCH_SIZE_MAX;
    private static readonly VERSION_MAX_BATCHES_PER_TICK_DEFAULT;
    private static readonly VERSION_LEASE_MS_DEFAULT;
    private static readonly VERSION_LATEST_TTL_MS_DEFAULT;
    private static readonly VERSION_REDIS_TIMEOUT_MS_DEFAULT;
    private static readonly VERSION_LEASE_WARN_INTERVAL;
    private static readonly ALERT_THRESHOLD;
    private static readonly ALERT_LOG_INTERVAL;
    private static readonly MAX_PUBLISH_ATTEMPTS;
    private static readonly PUBLISH_RETRY_BASE_DELAY;
    private static readonly PUBLISH_RETRY_MAX_DELAY;
    private static readonly MAX_JITTER;
    private static readonly STUCK_PROCESSING_TIMEOUT;
    private static readonly STUCK_FALLBACK_MAX_AGE;
    private static readonly STUCK_METRIC_AGE;
    private static readonly PRIORITY_TRANSITION_DELAY;
    private static readonly NORMAL_DRAIN_BUDGET_MS_DEFAULT;
    private static readonly USER_EVENTS_LIMIT;
    private static readonly USER_PRIORITY_INDEX;
    private static readonly USER_EVENT_TYPE_INDEX;
    private static readonly HINT_FALLBACK_WARN_INTERVAL;
    private intervalId;
    private versionEventIntervalId;
    private monitoringId;
    private lastAlertLoggedAt;
    private readonly outboxModel;
    private readonly serviceOffset;
    private readonly serviceLabel;
    private readonly versionEventInterval;
    private readonly versionBatchSize;
    private readonly versionMaxBatchesPerTick;
    private versionDrainRunning;
    private normalDrainRunning;
    private readonly normalDrainBudgetMs;
    private readonly coalesceSubjects;
    private readonly versionLeases;
    private readonly podId;
    private lastLeaseWarnAt;
    private lastHintFallbackWarnAt;
    private lastProcessedPriority;
    private static readonly PRIORITY_MAP_TTL;
    private static readonly PRIORITY_MAP_MAX_SIZE;
    constructor(natsClient: Stan, connection: mongoose.Connection, serviceName?: ServiceName);
    /**
     * Outbox gauge'ları için anlık durum (UC-984). Yayıncıyla aynı environment filtresi kullanılır:
     * paylaşımlı Mongo'daki development kayıtları canlı alarmına girmez.
     */
    private collectOutboxMetrics;
    /** Pozitif tam sayı env değeri; boş ya da geçersizse varsayılan. */
    private static readPositiveIntEnv;
    /** Sıfır ya da pozitif tam sayı env değeri; boş ya da geçersizse varsayılan. */
    /**
     * UC-1135: yayın anında birleştirilecek olay tipleri (OUTBOX_COALESCE_SUBJECTS, virgüllü). Boş/yok = kapalı.
     * Yalnız COALESCIBLE_SUBJECTS içindeki tipler kabul edilir; listede olmayan tip (ör. sync:requested) sessizce yok sayılır.
     */
    private static readCoalesceSubjects;
    private static readNonNegativeIntEnv;
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
    /**
     * TTL-based cleanup — eski veya aşırı büyümüş priority kayıtlarını temizle
     */
    private cleanupPriorityMap;
    /**
     * Normal olay turu (UC-1082): tek geçişi bütçe dolana ya da bir geçiş hiç olay yayınlamayana kadar tekrarlar.
     * Bir tur bir sonraki interval'e taşarsa ikinci tur başlamaz. Priority geçiş beklemesi ve _system_ önceliği
     * her geçişte aynen uygulanır: bekleyen kullanıcı o geçişte olay yayınlamaz, döngü onu zorlamaz.
     */
    private processEvents;
    /** Tek geçiş: _system_ olayları ya da en çok 10 kullanıcının en düşük priority'li olayları. Yayınlanan olay sayısını döndürür. */
    private processEventsOnce;
    /**
     * Kullanıcının en düşük priority'li bekleyen olayları (UC-1117), en çok USER_EVENTS_LIMIT kayıt, priority ve
     * creationDate sırasıyla. İki sorgu, her biri kendi indeksine hint'li: önce priority 1-4 (ve priority'siz eski
     * kayıtlar), yoksa priority 5. Sürüm olayları ilk sorgunun indeks aralığına girmez, ikincide eventType sınırıyla
     * atlanır. İlk sorgu boş değilse sonuç tek sorgununkiyle aynıdır: sonraki adım yalnız en düşük priority'yi yayınlar.
     */
    private findUserEvents;
    /** İndeks yoksa ya da henüz kuruluyorsa Mongo hint'li sorguyu reddeder; yayın durmasın diye hint'siz yeniden sorgular. */
    private findWithHint;
    /**
     * Event batch'ini işle — paralel, concurrency limit ile
     */
    private static readonly CONCURRENCY_LIMIT;
    /** Her güncelleme tam durumu taşıyan, yalnız en yüksek sürümü anlamlı olan olay tipleri (payload.id + payload.version). */
    private static readonly COALESCIBLE_SUBJECTS;
    private processEventBatch;
    /**
     * UC-1135: bayraktaki tiplerde aynı (tip, kullanıcı, payload.id) için partideki en yüksek payload.version kazanır.
     * Eşit sürümde ilk gelen (en eski) kazanır. Sürümü/id'si olmayan kayıt birleşmez, olduğu gibi yayınlanır.
     * Bayrak kapalıyken toPublish = events (davranış değişmez).
     */
    private groupCoalescible;
    /** Kaybedenleri claim et; başka pod'un aldığı satır dokunulmadan kalır (claimedAt filtresi sonraki adımda onu ayıklar). */
    private claimLosers;
    /**
     * Kazanan yayınlandıysa kaybedenler 'superseded' + supersededBy olur; yayınlanmadıysa pending'e döner.
     * Güncelleme düşerse kaybedenler processing'te kalır, monitorFailedEvents 5 dk sonra kurtarır (çift, kayıp değil).
     */
    private settleLosers;
    /** Olay bu çağrıda yayınlanıp published işaretlendiyse true. */
    private processOneEvent;
    /**
     * Yayını başarısız olan kayıtları işaretle (issue #648 K-1).
     * Deneme hakkı kalan kayıt `failed` + `nextAttemptAt` alır ve monitorFailedEvents süre dolunca onu
     * `pending`'e geri çevirir. Hakkı biten kayıt kalıcı `failed` kalır ve ALERT sayımına girer.
     * Filtre claim anındaki `retryCount`'u içerir; retryCount durum değişikliğiyle aynı güncellemede arttığı için
     * kaydı eski bir okumayla yeniden claim eden ya da ikinci kez sayan başka bir pod olamaz.
     */
    private markPublishFailed;
    /**
     * Başarısız denemeden sonraki bekleme: 30 sn, 60 sn, 120 sn, 240 sn (üst sınır 4 dk).
     * Beklemeler toplam 7,5 dk; publisher'ların kendi iç denemeleriyle (~10 sn × 5) kayıt ~8 dk'lık
     * NATS kesintisinden sonra kalıcı failed olur.
     */
    private getPublishRetryDelay;
    /**
     * EntityVersionUpdated eventlerini biriktirip BULK olarak publish eder.
     * Ayrı bir interval ile çalışır (varsayılan 2 dk). Her tur, kuyruk boşalana ya da
     * versionMaxBatchesPerTick partiye gelene kadar en fazla versionBatchSize olaylık
     * EntityVersionBulkUpdated mesajları gönderir (UC-984). Mesaj biçimi değişmedi: eski ve yeni
     * pod'lar aynı kuyruktan atomik claim ile birlikte yayın yapabilir.
     */
    private processVersionEventsAsBulk;
    /**
     * Tek parti: en eski versionBatchSize kaydı claim edip tek NATS mesajıyla yayınlar.
     * `more`: kuyrukta kayıt kalmış olabilir ve yayın başarılı — aynı turda bir parti daha denenebilir.
     */
    private publishVersionEventBatch;
    private leaseEntity;
    /** null: Redis kullanılamadı, gönderim kirasız (yalnız Mongo claim'iyle) sürer */
    private acquireVersionLeases;
    /** Redis hatası/zaman aşımı yutulur (null döner): kira yalnız çift gönderimi önler, gönderimi asla durdurmaz */
    private versionLeaseCall;
    private monitorFailedEvents;
    private publishEvent;
}
