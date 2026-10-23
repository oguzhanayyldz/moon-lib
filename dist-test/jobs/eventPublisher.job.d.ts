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
    private static readonly ALERT_THRESHOLD;
    private static readonly ALERT_LOG_INTERVAL;
    private static readonly MAX_PUBLISH_ATTEMPTS;
    private static readonly PUBLISH_RETRY_BASE_DELAY;
    private static readonly PUBLISH_RETRY_MAX_DELAY;
    private static readonly MAX_JITTER;
    private static readonly PRIORITY_TRANSITION_DELAY;
    private intervalId;
    private versionEventIntervalId;
    private monitoringId;
    private lastAlertLoggedAt;
    private readonly outboxModel;
    private readonly serviceOffset;
    private readonly versionEventInterval;
    private readonly versionBatchSize;
    private readonly versionMaxBatchesPerTick;
    private versionDrainRunning;
    private lastProcessedPriority;
    private static readonly PRIORITY_MAP_TTL;
    private static readonly PRIORITY_MAP_MAX_SIZE;
    constructor(natsClient: Stan, connection: mongoose.Connection, serviceName?: ServiceName);
    /** Pozitif tam sayı env değeri; boş ya da geçersizse varsayılan. */
    private static readPositiveIntEnv;
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
    private processEvents;
    /**
     * Event batch'ini işle — paralel, concurrency limit ile
     */
    private static readonly CONCURRENCY_LIMIT;
    private processEventBatch;
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
    private monitorFailedEvents;
    private publishEvent;
}
//# sourceMappingURL=eventPublisher.job.d.ts.map