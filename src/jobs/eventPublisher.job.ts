import mongoose, { FilterQuery } from 'mongoose';
import { Stan } from 'node-nats-streaming';
import { Subjects, ServiceName } from '../common/';
import { createOutboxModel, OutboxDoc, OutboxModel } from '../models/outbox.schema';
import { ProductCreatedPublisher } from '../events/publishers/productCreated.publisher';
import { ProductUpdatedPublisher } from '../events/publishers/productUpdated.publisher';
// Combination/PPL/RPL publisher import'ları kaldırıldı (issue #507)
import { UserCreatedPublisher } from '../events/publishers/userCreated.publisher';
import { UserUpdatedPublisher } from '../events/publishers/userUpdated.publisher';
import { UserConfigUpdatedPublisher } from '../events/publishers/userConfigUpdated.publisher';
import { IntegrationCommandPublisher } from '../events/publishers/integrationCommand.publisher';
import { ProductStockCreatedPublisher } from '../events/publishers/productStockCreated.publisher';
import { ProductStockUpdatedPublisher } from '../events/publishers/productStockUpdated.publisher';
import { StockCreatedPublisher } from '../events/publishers/stockCreated.publisher';
import { StockUpdatedPublisher } from '../events/publishers/stockUpdated.publisher';
import { OrderCreatedPublisher } from '../events/publishers/orderCreated.publisher';
import { OrderUpdatedPublisher } from '../events/publishers/orderUpdated.publisher';
import { EntityDeletedPublisher } from '../events/publishers/entityDeleted.publisher';
import { OrderStatusUpdatedPublisher } from '../events/publishers/orderStatusUpdated.publisher';
import { IntegrationCommandResultPublisher } from '../events/publishers/integrationCommandResult.publisher';
import { ProductIntegrationCreatedPublisher } from '../events/publishers/productIntegrationCreated.publisher';
import { DeleteProductImagesCompletedPublisher } from '../events/publishers/deleteProductImagesCompletedPublisher.publisher';
import { DeleteProductImagesPublisher } from '../events/publishers/deleteProductImagesPublisher.publisher';
import { ImportImagesFromUrlsPublisher } from '../events/publishers/importImagesFromUrlsPublisher.publisher';
import { ImportImagesFromUrlsCompletedPublisher } from '../events/publishers/importImagesFromUrlsCompletedPublisher.publisher';
import { ProductPriceIntegrationUpdatedPublisher } from '../events/publishers/productPriceIntegrationUpdated.publisher';
import { ProductPriceUpdatedPublisher } from '../events/publishers/productPriceUpdated.publisher';
import { ProductCostUpdatedPublisher } from '../events/publishers/productCostUpdated.publisher';
import { OrderProductCostAssignedPublisher } from '../events/publishers/orderProductCostAssigned.publisher';
import { ProductErpIdUpdatedPublisher } from '../events/publishers/productErpIdUpdated.publisher';
import { ProductStockIntegrationUpdatedPublisher } from '../events/publishers/productStockIntegrationUpdated.publisher';
import { ProductImageIntegrationUpdatedPublisher } from '../events/publishers/productImageIntegrationUpdated.publisher';
import { CatalogMappingCreatedPublisher } from '../events/publishers/catalogMappingCreated.publisher';
import { ProductIntegrationSyncedPublisher } from '../events/publishers/productIntegrationSynced.publisher';
import { OrderIntegrationCreatedPublisher } from '../events/publishers/orderIntegrationCreated.publisher';
import { logger } from '../services/logger.service';
import { EventMetrics, OutboxMetricsSnapshot } from '../metrics/EventMetrics';
import { IntegrationCreatedPublisher } from '../events/publishers/integrationCreated.publisher';
import { IntegrationUpdatedPublisher } from '../events/publishers/integrationUpdated.publisher';
import { UserIntegrationSettingsPublisher } from '../events/publishers/userIntegrationSettings.publisher';
import { OrderIntegrationStatusUpdatedPublisher } from '../events/publishers/orderIntegrationStatusUpdated.publisher';
import { ProductMatchedPublisher } from '../events/publishers/productMatched.publisher';
import { NotificationCreatedPublisher } from '../events/publishers/notificationCreated.publisher';
import { NewsletterEmailRequestedPublisher } from '../events/publishers/newsletterEmailRequested.publisher';
import { UserSessionsRevokedPublisher } from '../events/publishers/userSessionsRevoked.publisher';
import { OrderProductStockUpdatedPublisher } from '../events/publishers/orderProductUpdated.publisher';
import { EntityVersionUpdatedPublisher } from '../events/publishers/entityVersionUpdated.publisher';
import { versionEventKey } from '../utils/versionEventOutbox.util';
import { VersionEventLeases, VersionLeaseDecision, VersionLeaseEntity } from '../utils/versionEventLease.util';
import { redisWrapper } from '../services/redisWrapper.service';
import os from 'os';
import { EntityVersionBulkUpdatedPublisher } from '../events/publishers/entityVersionBulkUpdated.publisher';
import { SyncRequestedPublisher } from '../events/publishers/syncRequested.publisher';
import { InvoiceCreatedPublisher } from '../events/publishers/invoiceCreated.publisher';
import { InvoiceUpdatedPublisher } from '../events/publishers/invoiceUpdated.publisher';
import { InvoiceFormalizedPublisher } from '../events/publishers/invoiceFormalized.publisher';
import { InvoiceFailedPublisher } from '../events/publishers/invoiceFailed.publisher';
// OrderCargoUpdatedPublisher kaldırıldı (issue #507)
import { ShipmentCreatedPublisher } from '../events/publishers/shipmentCreated.publisher';
import { ShipmentUpdatedPublisher } from '../events/publishers/shipmentUpdated.publisher';
import { ExcelFileGeneratedPublisher } from '../events/publishers/excelFileGenerated.publisher';
import { ExcelFileStoredPublisher } from '../events/publishers/excelFileStored.publisher';
import { PlatformCategorySyncedPublisher } from '../events/publishers/platformCategorySynced.publisher';
import { PlatformBrandSyncedPublisher } from '../events/publishers/platformBrandSynced.publisher';
import { CategoryCreatedPublisher } from '../events/publishers/categoryCreated.publisher';
import { CategoryUpdatedPublisher } from '../events/publishers/categoryUpdated.publisher';
import { BrandCreatedPublisher } from '../events/publishers/brandCreated.publisher';
import { BrandUpdatedPublisher } from '../events/publishers/brandUpdated.publisher';
import { CustomerUpdatedPublisher } from '../events/publishers/customerUpdated.publisher';
import { CustomerAddressUpdatedPublisher } from '../events/publishers/customerAddressUpdated.publisher';
import { CatalogMappingUpdatedPublisher } from '../events/publishers/catalogMappingUpdated.publisher';
import { UpdateOrderCargoLabelPublisher } from '../events/publishers/updateOrderCargoLabel.publisher';
import { OrderWorkPackageInfoBulkUpdatedPublisher } from '../events/publishers/orderWorkPackageInfoBulkUpdated.publisher';
import { SubscriptionUpdatedPublisher } from '../events/publishers/subscriptionUpdated.publisher';
import { SubscriptionPaymentCompletedPublisher } from '../events/publishers/subscriptionPaymentCompleted.publisher';
import { SubscriptionPaymentFailedPublisher } from '../events/publishers/subscriptionPaymentFailed.publisher';
import { SubscriptionInvoiceCreatedPublisher } from '../events/publishers/subscriptionInvoiceCreated.publisher';
import { PriceProcessingCompletedPublisher } from '../events/publishers/priceProcessingCompleted.publisher';
import { IntegrationAuthFailureExceededPublisher } from '../events/publishers/integrationAuthFailureExceeded.publisher';
import { StockUpdateConfirmedPublisher } from '../events/publishers/stockUpdateConfirmed.publisher';
import { ProductPreMatchUpdatedPublisher } from '../events/publishers/productPreMatchUpdated.publisher';
import { StockCountStartedPublisher } from '../events/publishers/stockCountStarted.publisher';
import { StockCountFinishedPublisher } from '../events/publishers/stockCountFinished.publisher';


export class EventPublisherJob {
    private static readonly RETRY_INTERVAL = 3000; // 3 saniye (normal eventler için)
    // UC-984: sürüm olayları 2 dk'da bir 100'lük tek parti gönderiliyordu (saatte en fazla 3.000); tepe üretimi
    // 4.200–4.700/sa olunca kuyruk büyüyordu. Artık tur 5 sn'de bir çalışır ve kuyruk boşalana ya da parti tavanına
    // gelene kadar partiler gönderir (bekleyen sürüm olayının yaşı tepe saatte de saniyeler mertebesinde kalır).
    // Üçü de env ile ayarlanır; geçersiz değer varsayılana düşer.
    private static readonly VERSION_EVENT_INTERVAL_DEFAULT = 5000; // 5 saniye
    // Tek NATS mesajındaki olay sayısı tavanı (mesaj boyutu). Env ile küçültülebilir, büyütülemez.
    private static readonly VERSION_BATCH_SIZE_MAX = 100;
    private static readonly VERSION_MAX_BATCHES_PER_TICK_DEFAULT = 20; // tur başına en fazla 20×100 olay
    // UC-984 madde 9: Redis iletim kirası. Kira, en uzun yayından (NATS + Mongo işaretleme) uzun ve takılı processing
    // kurtarmasından (STUCK_PROCESSING_TIMEOUT) kısa olmalı: pod ölürse kira önce düşer, sonra kayıt yeniden kuyruğa girer.
    private static readonly VERSION_LEASE_MS_DEFAULT = 60000; // 1 dakika
    private static readonly VERSION_LATEST_TTL_MS_DEFAULT = 24 * 60 * 60000; // "gönderilmiş en son sürüm" 24 saat tutulur
    private static readonly VERSION_REDIS_TIMEOUT_MS_DEFAULT = 1000; // Redis yanıt vermezse gönderim beklemez
    private static readonly VERSION_LEASE_WARN_INTERVAL = 60000; // Redis yokken uyarı logu en fazla dakikada bir
    private static readonly ALERT_THRESHOLD = 5; // 5 başarısız event alert eşiği
    // Eşik aşılmış kaldıkça ALERT her pod'da en fazla bu aralıkla tekrar loglanır (izleme turu 3 sn'de bir koşar).
    // Kalıcı failed olan her kayıt ayrıca olduğu anda markPublishFailed içinde loglanır.
    private static readonly ALERT_LOG_INTERVAL = 15 * 60000; // 15 dakika
    // Issue #648 K-1: bir kaydın job seviyesindeki yayın denemesi üst sınırı. Hakkı kalan başarısız kayıt
    // bekleme süresi dolunca yeniden kuyruğa alınır (30 sn → 60 → 120 → 240 sn); son denemede kalıcı failed olur.
    private static readonly MAX_PUBLISH_ATTEMPTS = 5;
    private static readonly PUBLISH_RETRY_BASE_DELAY = 30000; // 30 saniye
    private static readonly PUBLISH_RETRY_MAX_DELAY = 240000; // 4 dakika
    private static readonly MAX_JITTER = 500; // 0-500ms random jitter
    // processing'te kalan kayıt bu süreden sonra pending'e döner
    private static readonly STUCK_PROCESSING_TIMEOUT = 5 * 60000; // 5 dakika
    // UC-984: processingStartedAt'ı olmayan (ya da Date olmayan) processing kaydı updatedOn/creationDate'e göre
    // kurtarılır; ama yalnız bu pencere içindekiler. Daha eskileri (Ocak–Mart birikimi) kendiliğinden yeniden
    // yayınlanmaz: bayat olayın yeniden yayını ayrı ve onaylı bir operasyondur (scripts/ops kurtarma betiği).
    private static readonly STUCK_FALLBACK_MAX_AGE = 24 * 60 * 60000; // 24 saat
    // Metrikte "kendiliğinden kurtulmayacak" sayılan processing kaydı: otomatik kurtarmanın iki katı süre
    private static readonly STUCK_METRIC_AGE = 2 * EventPublisherJob.STUCK_PROCESSING_TIMEOUT;
    private static readonly PRIORITY_TRANSITION_DELAY = 5000; // 5 saniye - priority geçişlerinde bekleme
    // UC-1082: normal olaylar 3 sn'de bir tek geçişle (kullanıcı başına 50 olay) yayınlanıyordu; tek kullanıcının
    // tavanı ~1.000 olay/dk idi ve 10.000 siparişlik birikim 40 dk'da boşalıyordu. Tur artık bu bütçe dolana ya da
    // kuyrukta yayınlanacak olay kalmayana kadar geçişi tekrarlar. 0 = eski tek geçiş davranışı (OUTBOX_DRAIN_BUDGET_MS).
    private static readonly NORMAL_DRAIN_BUDGET_MS_DEFAULT = 2000;
    private static readonly USER_EVENTS_LIMIT = 50;
    // UC-1117: kullanıcı başı sorgunun indeksleri (outbox.schema.ts). Hint'siz tek sorguda planlayıcı, sürüm olayı
    // birikiminde eventType'lı indeksi seçip önbelleğe alıyor; birikim iş olayına dönünce plan değişmiyor ve her
    // geçiş binlerce bekleyen kaydı okuyup bellekte sıralıyordu (UC-1082 profili: sorgu başına ~12 bin belge).
    private static readonly USER_PRIORITY_INDEX = { status: 1, environment: 1, userId: 1, priority: 1, creationDate: 1 } as const;
    private static readonly USER_EVENT_TYPE_INDEX = { status: 1, environment: 1, retryCount: 1, userId: 1, eventType: 1 } as const;
    private static readonly HINT_FALLBACK_WARN_INTERVAL = 60000; // hint'siz sorguya düşme uyarısı en fazla dakikada bir
    private intervalId: NodeJS.Timeout | null = null;
    private versionEventIntervalId: NodeJS.Timeout | null = null; // Version eventleri için ayrı interval
    private monitoringId: NodeJS.Timeout | null = null;
    private lastAlertLoggedAt: number | null = null; // Son ALERT logunun zamanı; sayı eşiğin altına inince sıfırlanır
    private readonly outboxModel: OutboxModel;
    private readonly serviceOffset: number; // Servis bazlı offset (thundering herd prevention)
    private readonly serviceLabel: string; // Metrik etiketi (SERVICE_NAME)
    private readonly versionEventInterval: number;
    private readonly versionBatchSize: number;
    private readonly versionMaxBatchesPerTick: number;
    // Bir tur bir sonraki interval'e taşarsa ikinci tur başlamaz (aynı pod'da üst üste boşaltma yok)
    private versionDrainRunning = false;
    private normalDrainRunning = false;
    private readonly normalDrainBudgetMs: number;
    private readonly versionLeases: VersionEventLeases;
    private readonly podId = process.env.HOSTNAME || os.hostname();
    private lastLeaseWarnAt = 0;
    private lastHintFallbackWarnAt = 0;
    
    // Kullanıcı bazlı son işlenen priority takibi (priority geçiş bekleme için)
    private lastProcessedPriority: Map<string, { priority: number; timestamp: number }> = new Map();
    private static readonly PRIORITY_MAP_TTL = 300000; // 5 dakika — bu süreden eski entry'ler temizlenir
    private static readonly PRIORITY_MAP_MAX_SIZE = 2000; // Maksimum kullanıcı sayısı


    constructor (
        private natsClient: Stan,
        private connection: mongoose.Connection,
        serviceName?: ServiceName // Optional: Thundering herd prevention için
    ) {
        this.outboxModel = createOutboxModel(connection);
        
        // Servis adını belirle: parametre > env > undefined
        const resolvedServiceName = serviceName || this.resolveServiceNameFromEnv();
        
        // Servis adından deterministik offset hesapla (0-2500ms arası)
        this.serviceOffset = this.calculateServiceOffset(resolvedServiceName);
        this.serviceLabel = resolvedServiceName || 'unknown';

        this.versionEventInterval = EventPublisherJob.readPositiveIntEnv('VERSION_EVENT_INTERVAL_MS', EventPublisherJob.VERSION_EVENT_INTERVAL_DEFAULT);
        this.versionBatchSize = Math.min(
            EventPublisherJob.readPositiveIntEnv('VERSION_EVENT_BATCH_SIZE', EventPublisherJob.VERSION_BATCH_SIZE_MAX),
            EventPublisherJob.VERSION_BATCH_SIZE_MAX
        );
        this.versionMaxBatchesPerTick = EventPublisherJob.readPositiveIntEnv('VERSION_EVENT_MAX_BATCHES_PER_TICK', EventPublisherJob.VERSION_MAX_BATCHES_PER_TICK_DEFAULT);
        this.normalDrainBudgetMs = EventPublisherJob.readNonNegativeIntEnv('OUTBOX_DRAIN_BUDGET_MS', EventPublisherJob.NORMAL_DRAIN_BUDGET_MS_DEFAULT);
        this.versionLeases = new VersionEventLeases(() => redisWrapper.client, {
            leaseMs: EventPublisherJob.readPositiveIntEnv('VERSION_EVENT_LEASE_MS', EventPublisherJob.VERSION_LEASE_MS_DEFAULT),
            latestTtlMs: EventPublisherJob.readPositiveIntEnv('VERSION_EVENT_LATEST_TTL_MS', EventPublisherJob.VERSION_LATEST_TTL_MS_DEFAULT),
            timeoutMs: EventPublisherJob.readPositiveIntEnv('VERSION_EVENT_REDIS_TIMEOUT_MS', EventPublisherJob.VERSION_REDIS_TIMEOUT_MS_DEFAULT)
        });

        EventMetrics.setOutboxCollector(this.serviceLabel, () => this.collectOutboxMetrics());
    }

    /**
     * Outbox gauge'ları için anlık durum (UC-984). Yayıncıyla aynı environment filtresi kullanılır:
     * paylaşımlı Mongo'daki development kayıtları canlı alarmına girmez.
     */
    private async collectOutboxMetrics(): Promise<OutboxMetricsSnapshot> {
        const environment = process.env.NODE_ENV || 'production';
        const now = Date.now();
        const versionFilter = { environment, eventType: Subjects.EntityVersionUpdated };

        const [pending, processing, failed, oldest, stuckProcessing, failedFinal] = await Promise.all([
            this.outboxModel.countDocuments({ ...versionFilter, status: 'pending' }),
            this.outboxModel.countDocuments({ ...versionFilter, status: 'processing' }),
            this.outboxModel.countDocuments({ ...versionFilter, status: 'failed' }),
            this.outboxModel.findOne({ ...versionFilter, status: { $in: ['pending', 'processing'] } })
                .sort({ creationDate: 1 })
                .select({ creationDate: 1 })
                .lean(),
            this.outboxModel.countDocuments({
                environment,
                status: 'processing',
                $or: [
                    { processingStartedAt: { $lt: new Date(now - EventPublisherJob.STUCK_METRIC_AGE) } },
                    { processingStartedAt: { $not: { $type: 'date' } } }
                ]
            }),
            this.outboxModel.countDocuments({
                environment,
                status: 'failed',
                $or: [
                    { retryCount: { $gte: EventPublisherJob.MAX_PUBLISH_ATTEMPTS } },
                    { nextAttemptAt: { $not: { $type: 'date' } } }
                ]
            })
        ]);

        const oldestCreated = (oldest as { creationDate?: Date } | null)?.creationDate;
        return {
            versionRecords: { pending, processing, failed },
            versionOldestPendingAgeSeconds: oldestCreated ? Math.max(0, (now - new Date(oldestCreated).getTime()) / 1000) : 0,
            stuckProcessing,
            failedFinal
        };
    }

    /** Pozitif tam sayı env değeri; boş ya da geçersizse varsayılan. */
    private static readPositiveIntEnv(name: string, fallback: number): number {
        const value = Number(process.env[name]);
        return Number.isInteger(value) && value > 0 ? value : fallback;
    }

    /** Sıfır ya da pozitif tam sayı env değeri; boş ya da geçersizse varsayılan. */
    private static readNonNegativeIntEnv(name: string, fallback: number): number {
        const raw = process.env[name];
        if (raw === undefined || raw.trim() === '') return fallback;
        const value = Number(raw);
        return Number.isInteger(value) && value >= 0 ? value : fallback;
    }

    /**
     * Environment variable'dan servis adını çöz
     */
    private resolveServiceNameFromEnv(): ServiceName | undefined {
        const envServiceName = process.env.SERVICE_NAME;
        if (!envServiceName) return undefined;
        
        // ServiceName enum'unda ara (case-insensitive)
        const serviceValues = Object.values(ServiceName) as string[];
        const found = serviceValues.find(s => s.toLowerCase() === envServiceName.toLowerCase());
        return found as ServiceName | undefined;
    }


    /**
     * Servis adından deterministik offset hesapla
     * Bu sayede farklı servisler farklı zamanlarda çalışır (thundering herd prevention)
     */
    private calculateServiceOffset(serviceName?: ServiceName): number {
        if (!serviceName) return 0;
        
        // ServiceName enum değerlerinin index'ini al (0-based)
        const serviceValues = Object.values(ServiceName);
        const serviceIndex = serviceValues.indexOf(serviceName);
        
        if (serviceIndex === -1) return 0;
        
        // Her servis için 300ms offset (8 servis = 0, 300, 600, 900, 1200, 1500, 1800, 2100ms)
        const offset = (serviceIndex % 8) * 300;
        return offset;
    }

    /**
     * Random jitter ekle (0-500ms)
     * Bu sayede aynı servisin farklı pod'ları bile aynı anda çalışmaz
     */
    private getJitter(): number {
        return Math.floor(Math.random() * EventPublisherJob.MAX_JITTER);
    }

    async start() {
        // Servis bazlı offset + random jitter ile başlangıcı geciktir
        const initialDelay = this.serviceOffset + this.getJitter();
        
        logger.info(`EventPublisherJob starting with offset=${this.serviceOffset}ms, initialDelay=${initialDelay}ms`);

        // İlk çalışmayı geciktir, sonra normal interval ile devam et
        setTimeout(() => {
            // Normal event publishing job (3 saniye)
            this.intervalId = setInterval(async () => {
                await this.processEvents();
            }, EventPublisherJob.RETRY_INTERVAL);

            // Version event bulk publishing job (varsayılan 5 sn, VERSION_EVENT_INTERVAL_MS)
            this.versionEventIntervalId = setInterval(async () => {
                await this.processVersionEventsAsBulk();
            }, this.versionEventInterval);

            // Monitoring job
            this.monitoringId = setInterval(async () => {
                await this.monitorFailedEvents();
            }, EventPublisherJob.RETRY_INTERVAL);

            logger.info(`EventPublisherJob started: normal=${EventPublisherJob.RETRY_INTERVAL}ms (drainBudget=${this.normalDrainBudgetMs}ms), version=${this.versionEventInterval}ms (batch=${this.versionBatchSize}, maxBatches=${this.versionMaxBatchesPerTick}), serviceOffset=${this.serviceOffset}ms`);
        }, initialDelay);
    }

    stop() {
        [this.intervalId, this.versionEventIntervalId, this.monitoringId].forEach(interval => {
            if (interval) clearInterval(interval);
        });
        this.intervalId = null;
        this.versionEventIntervalId = null;
        this.monitoringId = null;
        this.lastProcessedPriority.clear();
    }

    /**
     * TTL-based cleanup — eski veya aşırı büyümüş priority kayıtlarını temizle
     */
    private cleanupPriorityMap() {
        const now = Date.now();

        // TTL temizliği
        for (const [userId, entry] of this.lastProcessedPriority) {
            if (now - entry.timestamp > EventPublisherJob.PRIORITY_MAP_TTL) {
                this.lastProcessedPriority.delete(userId);
            }
        }

        // Max size aşımı kontrolü — en eski entry'leri sil
        if (this.lastProcessedPriority.size > EventPublisherJob.PRIORITY_MAP_MAX_SIZE) {
            const entries = [...this.lastProcessedPriority.entries()]
                .sort((a, b) => a[1].timestamp - b[1].timestamp);
            const deleteCount = entries.length - EventPublisherJob.PRIORITY_MAP_MAX_SIZE;
            for (let i = 0; i < deleteCount; i++) {
                this.lastProcessedPriority.delete(entries[i][0]);
            }
        }
    }

    /**
     * Normal olay turu (UC-1082): tek geçişi bütçe dolana ya da bir geçiş hiç olay yayınlamayana kadar tekrarlar.
     * Bir tur bir sonraki interval'e taşarsa ikinci tur başlamaz. Priority geçiş beklemesi ve _system_ önceliği
     * her geçişte aynen uygulanır: bekleyen kullanıcı o geçişte olay yayınlamaz, döngü onu zorlamaz.
     */
    private async processEvents() {
        if (this.normalDrainRunning) {
            logger.debug('Previous outbox drain is still running, skipping this tick');
            return;
        }
        this.normalDrainRunning = true;
        try {
            const deadline = Date.now() + this.normalDrainBudgetMs;
            let passes = 0;
            let published = 0;
            do {
                const passPublished = await this.processEventsOnce();
                passes++;
                published += passPublished;
                if (passPublished === 0) break;
            } while (Date.now() < deadline);
            if (published > 0) {
                logger.info(`Outbox drain: ${published} events in ${passes} passes`);
            }
        } finally {
            this.normalDrainRunning = false;
        }
    }

    /** Tek geçiş: _system_ olayları ya da en çok 10 kullanıcının en düşük priority'li olayları. Yayınlanan olay sayısını döndürür. */
    private async processEventsOnce(): Promise<number> {
        let published = 0;
        try {
            // TTL-based cleanup — eski priority kayıtlarını temizle (bellek sızıntısı önleme)
            this.cleanupPriorityMap();

            const currentEnvironment = process.env.NODE_ENV || 'production';

            // ✅ STEP 1: Önce _system_ kullanıcısının event'lerini işle (en yüksek öncelik)
            const systemEvents = await this.outboxModel.find({
                status: 'pending',
                environment: currentEnvironment,
                retryCount: { $lt: EventPublisherJob.MAX_PUBLISH_ATTEMPTS },
                eventType: { $ne: Subjects.EntityVersionUpdated },
                $or: [
                    { userId: '_system_' },
                    { userId: { $exists: false } }, // Eski kayıtlar
                    { userId: null }
                ]
            })
            .sort({ priority: 1, creationDate: 1 })
            .limit(20);

            if (systemEvents.length > 0) {
                logger.debug(`Processing ${systemEvents.length} _system_ events (highest priority)`);
                return await this.processEventBatch(systemEvents); // _system_ bitmeden diğerlerine geçme
            }

            // ✅ STEP 2: Her kullanıcı için sequential priority işleme
            const usersWithPendingEvents = await this.outboxModel.distinct('userId', {
                status: 'pending',
                environment: currentEnvironment,
                retryCount: { $lt: EventPublisherJob.MAX_PUBLISH_ATTEMPTS },
                eventType: { $ne: Subjects.EntityVersionUpdated },
                userId: { $nin: ['_system_', null] }
            });

            if (usersWithPendingEvents.length === 0) {
                return 0;
            }

            // Her kullanıcı için en yüksek öncelikli event'leri işle
            for (const userId of usersWithPendingEvents.slice(0, 10)) {
                // Priority sıralı event'leri al, en düşük priority'yi belirle
                const sortedEvents = await this.findUserEvents(userId, currentEnvironment);

                if (sortedEvents.length === 0) continue;

                // İlk event'in priority'si = en düşük priority
                const currentPriority = sortedEvents[0].priority ?? 3;

                // ✅ PRIORITY GEÇİŞ BEKLEMESİ: Önceki priority'den farklı bir priority'ye geçiyorsak bekle
                const lastProcessed = this.lastProcessedPriority.get(userId);
                if (lastProcessed && lastProcessed.priority < currentPriority) {
                    const timeSinceLastProcess = Date.now() - lastProcessed.timestamp;
                    const requiredWait = EventPublisherJob.PRIORITY_TRANSITION_DELAY;

                    if (timeSinceLastProcess < requiredWait) {
                        const remainingWait = requiredWait - timeSinceLastProcess;
                        logger.info(`⏳ Priority transition wait for user ${userId}: priority ${lastProcessed.priority} → ${currentPriority}, waiting ${remainingWait}ms for listeners to complete`);
                        continue;
                    }

                    logger.info(`✅ Priority transition complete for user ${userId}: ${lastProcessed.priority} → ${currentPriority} (waited ${timeSinceLastProcess}ms)`);
                }

                // ✅ Aynı priority'deki event'leri filtrele (tek sorgudan)
                const userEvents = sortedEvents.filter(e => {
                    const ePriority = e.priority ?? 3;
                    return ePriority === currentPriority;
                });

                if (userEvents.length > 0) {
                    logger.debug(`Processing ${userEvents.length} priority-${currentPriority} events for user ${userId}`);
                    published += await this.processEventBatch(userEvents);

                    // Son işlenen priority'yi güncelle
                    this.lastProcessedPriority.set(userId, {
                        priority: currentPriority,
                        timestamp: Date.now()
                    });

                    // ✅ Ek sorguya gerek yok: 50 event aldık, hepsi aynı priority değilse
                    // veya tam 50 geldiyse, demek ki daha var
                    const remainingCount = sortedEvents.length - userEvents.length;
                    const mightHaveMore = userEvents.length === EventPublisherJob.USER_EVENTS_LIMIT;

                    if (remainingCount > 0 || mightHaveMore) {
                        logger.debug(`User ${userId} still has pending events (same priority: ${mightHaveMore ? '50+' : '0'}, other priorities: ${remainingCount})`);
                    }
                }

            }
        } catch (error) {
            logger.error('Event processing failed:', error);
        }
        return published;
    }

    /**
     * Kullanıcının en düşük priority'li bekleyen olayları (UC-1117), en çok USER_EVENTS_LIMIT kayıt, priority ve
     * creationDate sırasıyla. İki sorgu, her biri kendi indeksine hint'li: önce priority 1-4 (ve priority'siz eski
     * kayıtlar), yoksa priority 5. Sürüm olayları ilk sorgunun indeks aralığına girmez, ikincide eventType sınırıyla
     * atlanır. İlk sorgu boş değilse sonuç tek sorgununkiyle aynıdır: sonraki adım yalnız en düşük priority'yi yayınlar.
     */
    private async findUserEvents(userId: string, environment: string) {
        const filter = {
            status: 'pending',
            environment,
            retryCount: { $lt: EventPublisherJob.MAX_PUBLISH_ATTEMPTS },
            eventType: { $ne: Subjects.EntityVersionUpdated },
            userId,
        };
        const urgent = await this.findWithHint({ ...filter, priority: { $not: { $gte: 5 } } }, EventPublisherJob.USER_PRIORITY_INDEX);
        if (urgent.length > 0) return urgent;
        return this.findWithHint({ ...filter, priority: { $gte: 5 } }, EventPublisherJob.USER_EVENT_TYPE_INDEX);
    }

    /** İndeks yoksa ya da henüz kuruluyorsa Mongo hint'li sorguyu reddeder; yayın durmasın diye hint'siz yeniden sorgular. */
    private async findWithHint(filter: FilterQuery<OutboxDoc>, index: Record<string, 1>) {
        const query = () => this.outboxModel.find(filter).sort({ priority: 1, creationDate: 1 }).limit(EventPublisherJob.USER_EVENTS_LIMIT);
        try {
            return await query().hint(index).lean();
        } catch (error) {
            const now = Date.now();
            if (now - this.lastHintFallbackWarnAt >= EventPublisherJob.HINT_FALLBACK_WARN_INTERVAL) {
                this.lastHintFallbackWarnAt = now;
                logger.warn(`Outbox query with index hint ${JSON.stringify(index)} failed, retrying without hint:`, error);
            }
            return query().lean();
        }
    }


    /**
     * Event batch'ini işle — paralel, concurrency limit ile
     */
    private static readonly CONCURRENCY_LIMIT = 5;

    private async processEventBatch(events: any[]): Promise<number> {
        let published = 0;
        // Concurrency limit ile paralel işleme
        for (let i = 0; i < events.length; i += EventPublisherJob.CONCURRENCY_LIMIT) {
            const chunk = events.slice(i, i + EventPublisherJob.CONCURRENCY_LIMIT);
            const results = await Promise.all(chunk.map(event => this.processOneEvent(event)));
            published += results.filter(Boolean).length;
        }
        return published;
    }

    /** Olay bu çağrıda yayınlanıp published işaretlendiyse true. */
    private async processOneEvent(event: any): Promise<boolean> {
        try {
            // Atomik güncelleme: pending durumundaki event'i processing olarak işaretle
            const claimedAt = new Date();
            const updated = await this.outboxModel.updateOne(
                {
                    _id: event.id,
                    status: 'pending',
                    retryCount: event.retryCount
                },
                {
                    $set: {
                        status: 'processing',
                        processingStartedAt: claimedAt
                    }
                }
            );

            // Event başka bir pod tarafından alınmış demektir, atla
            if (updated.modifiedCount === 0) {
                logger.debug(`Event ${event.id} is already being processed by another publisher, skipping`);
                return false;
            }

            // Deneme hakkını yalnız yayın hatası tüketir; Mongo durum güncellemesi hataları aşağıdaki catch'e düşer
            try {
                await this.publishEvent(event);
            } catch (error) {
                // Önce logla: markPublishFailed'daki Mongo hatası dış catch'e düşer ve asıl yayın hatası kaybolmaz
                logger.error(`Failed to publish event ${event.id}:`, error);
                await this.markPublishFailed({ _id: event.id, processingStartedAt: claimedAt }, event.retryCount);
                return false;
            }

            // Başarılı olarak işaretle
            await this.outboxModel.updateOne(
                { _id: event.id, status: 'processing', processingStartedAt: claimedAt },
                { $set: { status: 'published' } }
            );

            // UC-1117: olay başına satır debug'da; tur özeti processEvents'te info
            logger.debug(`Successfully published event ${event.id} (priority: ${event.priority}, user: ${event.userId})`);
            return true;
        } catch (error) {
            logger.error(`Failed to update outbox state of event ${event.id}:`, error);
            return false;
        }
    }

    /**
     * Yayını başarısız olan kayıtları işaretle (issue #648 K-1).
     * Deneme hakkı kalan kayıt `failed` + `nextAttemptAt` alır ve monitorFailedEvents süre dolunca onu
     * `pending`'e geri çevirir. Hakkı biten kayıt kalıcı `failed` kalır ve ALERT sayımına girer.
     * Filtre claim anındaki `retryCount`'u içerir; retryCount durum değişikliğiyle aynı güncellemede arttığı için
     * kaydı eski bir okumayla yeniden claim eden ya da ikinci kez sayan başka bir pod olamaz.
     */
    private async markPublishFailed(filter: FilterQuery<OutboxDoc>, retryCount: number): Promise<void> {
        const attempts = retryCount + 1;
        const exhausted = attempts >= EventPublisherJob.MAX_PUBLISH_ATTEMPTS;
        const now = new Date();

        const result = await this.outboxModel.updateMany(
            { ...filter, status: 'processing', retryCount },
            {
                $set: exhausted
                    ? { status: 'failed', lastAttempt: now }
                    : { status: 'failed', lastAttempt: now, nextAttemptAt: new Date(now.getTime() + this.getPublishRetryDelay(attempts)) },
                $inc: { retryCount: 1 }
            }
        );

        if (exhausted && result.modifiedCount > 0) {
            logger.error(`${result.modifiedCount} outbox event(s) permanently failed after ${attempts} publish attempts`, filter);
        }
    }

    /**
     * Başarısız denemeden sonraki bekleme: 30 sn, 60 sn, 120 sn, 240 sn (üst sınır 4 dk).
     * Beklemeler toplam 7,5 dk; publisher'ların kendi iç denemeleriyle (~10 sn × 5) kayıt ~8 dk'lık
     * NATS kesintisinden sonra kalıcı failed olur.
     */
    private getPublishRetryDelay(attempts: number): number {
        return Math.min(
            EventPublisherJob.PUBLISH_RETRY_BASE_DELAY * Math.pow(2, attempts - 1),
            EventPublisherJob.PUBLISH_RETRY_MAX_DELAY
        );
    }


    /**
     * EntityVersionUpdated eventlerini biriktirip BULK olarak publish eder.
     * Ayrı bir interval ile çalışır (varsayılan 2 dk). Her tur, kuyruk boşalana ya da
     * versionMaxBatchesPerTick partiye gelene kadar en fazla versionBatchSize olaylık
     * EntityVersionBulkUpdated mesajları gönderir (UC-984). Mesaj biçimi değişmedi: eski ve yeni
     * pod'lar aynı kuyruktan atomik claim ile birlikte yayın yapabilir.
     */
    private async processVersionEventsAsBulk() {
        if (this.versionDrainRunning) {
            logger.debug('Previous version event drain is still running, skipping this tick');
            return;
        }
        this.versionDrainRunning = true;
        try {
            let batches = 0;
            let published = 0;
            // İletimde olduğu için pending'e geri bırakılan kayıtlar bu turda yeniden alınmaz (aynı satırlar üzerinde dönme yok)
            const deferredIds = new Set<string>();
            while (batches < this.versionMaxBatchesPerTick) {
                const result = await this.publishVersionEventBatch(deferredIds);
                batches++;
                published += result.published;
                if (!result.more) break;
            }
            if (published > 0) {
                logger.info(`🔄 Version event drain: ${published} events in ${batches} batches`);
            }
        } finally {
            this.versionDrainRunning = false;
        }
    }

    /**
     * Tek parti: en eski versionBatchSize kaydı claim edip tek NATS mesajıyla yayınlar.
     * `more`: kuyrukta kayıt kalmış olabilir ve yayın başarılı — aynı turda bir parti daha denenebilir.
     */
    private async publishVersionEventBatch(deferredIds: Set<string> = new Set()): Promise<{ published: number; more: boolean }> {
        try {
            const currentEnvironment = process.env.NODE_ENV || 'production';

            // Sadece EntityVersionUpdated eventlerini al
            const candidates = await this.outboxModel.find({
                ...(deferredIds.size > 0 ? { _id: { $nin: [...deferredIds] } } : {}),
                status: 'pending',
                environment: currentEnvironment,
                retryCount: { $lt: EventPublisherJob.MAX_PUBLISH_ATTEMPTS },
                eventType: Subjects.EntityVersionUpdated
            })
                .sort({ creationDate: 1 })
                .limit(this.versionBatchSize);

            if (candidates.length === 0) {
                return { published: 0, more: false }; // İşlenecek event yok
            }

            const fullBatch = candidates.length === this.versionBatchSize;
            const candidateIds = candidates.map(e => e.id);
            const claimedAt = new Date();

            // Atomik olarak tüm eventleri 'processing' yap
            const updateResult = await this.outboxModel.updateMany(
                {
                    _id: { $in: candidateIds },
                    status: 'pending'
                },
                {
                    $set: {
                        status: 'processing',
                        processingStartedAt: claimedAt
                    }
                }
            );

            // Bazı eventler başka pod tarafından alınmış olabilir
            if (updateResult.modifiedCount === 0) {
                logger.debug('All version events already being processed by another publisher');
                return { published: 0, more: fullBatch };
            }

            // Claim SONRASI yeniden okunur: yalnız bu partinin aldığı kayıtlar yayınlanır (başka pod'unkiler iki kez
            // gitmez) ve claim'den hemen önce birleştirilen (writeVersionEventToOutbox) daha yeni sürüm kaybolmaz —
            // claim öncesi okunan `candidates` o güncellemeyi görmemiş olabilir (UC-984 madde 8)
            const versionEvents = await this.outboxModel.find({
                _id: { $in: candidateIds },
                status: 'processing',
                processingStartedAt: claimedAt
            });
            if (versionEvents.length === 0) {
                return { published: 0, more: fullBatch };
            }

            // Gönderimde birleştirme: aynı varlığın birden fazla kaydından yalnız en yüksek sürüm gider (eski pod'ların
            // her güncellemede açtığı satırlar ve eşzamanlı yazımda açılan ikinci satır burada toplanır)
            const winners = new Map<string, any>();
            for (const versionEvent of versionEvents) {
                const key = versionEventKey(versionEvent.payload);
                const current = winners.get(key);
                if (!current || (versionEvent.payload?.version ?? 0) > (current.payload?.version ?? 0)) {
                    winners.set(key, versionEvent);
                }
            }
            const batchId = `bulk-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
            const leaseToken = `${this.podId}:${batchId}`;

            // UC-984 madde 9: Redis iletim kirası — tek ağ turunda tüm kazananlar için karar.
            // Redis yoksa/yanıt vermezse null: bugünkü gibi yalnız Mongo claim'iyle gönderilir (kayıp yok, çift olabilir).
            const winnerList = [...winners.values()];
            const decisions = await this.acquireVersionLeases(winnerList, leaseToken);
            const toSend = winnerList.filter((_, i) => !decisions || decisions[i] === 'acquired');
            const leased = decisions ? toSend : [];
            const inflightKeys = new Set(winnerList.filter((_, i) => decisions?.[i] === 'inflight').map(e => versionEventKey(e.payload)));
            const deliveredKeys = new Set(winnerList.filter((_, i) => decisions?.[i] === 'delivered').map(e => versionEventKey(e.payload)));

            // İletimde olan varlığın satırları pending'e geri döner (retryCount artmaz); sonraki turda gönderilir
            const deferred = versionEvents.filter(e => inflightKeys.has(versionEventKey(e.payload)));
            if (deferred.length > 0) {
                await this.outboxModel.updateMany(
                    { _id: { $in: deferred.map(e => e._id) }, status: 'processing', processingStartedAt: claimedAt },
                    { $set: { status: 'pending' }, $unset: { processingStartedAt: 1 } }
                );
                deferred.forEach(e => deferredIds.add(e.id));
                EventMetrics.versionEventsDuplicatePreventedTotal.inc({ service: this.serviceLabel, reason: 'inflight' }, deferred.length);
            }
            // Bu sürüm ya da daha yenisi sync'e zaten gönderilmiş: gönderilmez, iz için 'superseded'
            const alreadyDelivered = versionEvents.filter(e => deliveredKeys.has(versionEventKey(e.payload)));
            if (alreadyDelivered.length > 0) {
                await this.outboxModel.updateMany(
                    { _id: { $in: alreadyDelivered.map(e => e._id) }, status: 'processing', processingStartedAt: claimedAt },
                    [{ $set: { status: 'superseded', supersededBy: { $concat: ['delivered:v', { $toString: '$payload.version' }] } } }]
                );
                EventMetrics.versionEventsDuplicatePreventedTotal.inc({ service: this.serviceLabel, reason: 'delivered' }, alreadyDelivered.length);
            }

            const sendKeys = new Set(toSend.map(e => versionEventKey(e.payload)));
            const eventIds = toSend.map(e => e.id);
            const superseded = versionEvents.filter(e => sendKeys.has(versionEventKey(e.payload)) && winners.get(versionEventKey(e.payload)) !== e);

            logger.debug(`🔄 Processing ${versionEvents.length} EntityVersionUpdated events as bulk (${toSend.length} sent, ${superseded.length} superseded, ${deferred.length} in flight elsewhere, ${alreadyDelivered.length} already delivered)`);

            if (toSend.length === 0) {
                return { published: 0, more: fullBatch };
            }

            EventMetrics.versionEventsInflight.set({ service: this.serviceLabel }, leased.length);
            try {
                // Bulk payload oluştur
                const bulkPayload = {
                    updates: toSend.map(e => e.payload),
                    batchId,
                    batchSize: toSend.length,
                    timestamp: new Date()
                };

                // TEK NATS mesajı gönder
                await new EntityVersionBulkUpdatedPublisher(this.natsClient).publish(bulkPayload);

                EventMetrics.outboxVersionEventsPublishedTotal.inc({ service: this.serviceLabel }, toSend.length);
                // Gönderilmiş sürüm Mongo işaretlemesinden ÖNCE yazılır: işaretleme düşüp kayıt yeniden kuyruğa girerse
                // aynı sürüm ikinci kez gönderilmez ('delivered'). Redis hatası yayını geri almaz.
                if (leased.length > 0) {
                    await this.versionLeaseCall('mark delivered', () => this.versionLeases.markDelivered(leased.map(e => this.leaseEntity(e))));
                }

                // Yalnız bu turun claim'i published olur (kurtarılıp başka pod'ca yeniden alınmış kayıt değil).
                // Bu güncelleme düşerse kayıtlar processing'te kalır, 5 dk sonra yeniden yayınlanır (çift, kayıp değil).
                await this.outboxModel.updateMany(
                    { _id: { $in: eventIds }, status: 'processing', processingStartedAt: claimedAt },
                    { $set: { status: 'published' } }
                );
                // Geride kalan sürümler silinmez: iz ve sayım için 'superseded' + gönderilen satırın kimliği.
                // Yayından SONRA işaretlenir: yayın düşerse hepsi failed olur, sonraki turda yeniden toplanır.
                if (superseded.length > 0) {
                    await this.outboxModel.bulkWrite(superseded.map(e => ({
                        updateOne: {
                            filter: { _id: e._id, status: 'processing', processingStartedAt: claimedAt },
                            update: { $set: { status: 'superseded', supersededBy: winners.get(versionEventKey(e.payload)).id } }
                        }
                    })), { ordered: false });
                    EventMetrics.versionEventsCoalescedTotal.inc({ service: this.serviceLabel, stage: 'send' }, superseded.length);
                }

                logger.debug(`✅ Bulk published ${toSend.length} EntityVersionUpdated events (batch: ${batchId})`);
                return { published: toSend.length, more: fullBatch };
            } catch (error) {
                // Önce logla: işaretleme sırasındaki Mongo hatası asıl yayın hatasını gizlemesin
                logger.error('❌ Failed to publish bulk EntityVersionUpdated events:', error);
                // Hata durumunda tümünü 'failed' yap; bekleme ve kalıcı başarısızlık kaydın kendi retryCount'una göre belirlenir
                const idsByRetryCount = new Map<number, string[]>();
                for (const versionEvent of versionEvents) {
                    const ids = idsByRetryCount.get(versionEvent.retryCount) ?? [];
                    ids.push(versionEvent.id);
                    idsByRetryCount.set(versionEvent.retryCount, ids);
                }
                for (const [retryCount, ids] of idsByRetryCount) {
                    await this.markPublishFailed({ _id: { $in: ids }, processingStartedAt: claimedAt }, retryCount);
                }
                // Yayın başarısız: bu turda başka parti denenmez (NATS sorunluysa yükü büyütme)
                return { published: 0, more: false };
            } finally {
                // Kira yalnız sahibince bırakılır; yayın ve işaretleme bittikten (ya da hata verdikten) sonra
                if (leased.length > 0) {
                    const expired = await this.versionLeaseCall('release', () => this.versionLeases.release(leased.map(e => this.leaseEntity(e)), leaseToken));
                    if (expired) {
                        EventMetrics.versionEventsLeaseExpiredTotal.inc({ service: this.serviceLabel }, expired);
                        logger.warn(`Version event lease expired before publish finished for ${expired} entities (batch: ${batchId}); increase VERSION_EVENT_LEASE_MS`);
                    }
                }
                EventMetrics.versionEventsInflight.set({ service: this.serviceLabel }, 0);
            }
        } catch (error) {
            logger.error('Version event bulk processing failed:', error);
            return { published: 0, more: false };
        }
    }

    private leaseEntity(versionEvent: any): VersionLeaseEntity {
        const { entityType, entityId, service, version } = versionEvent.payload ?? {};
        return { entityType: String(entityType), entityId: String(entityId), service: String(service), version: Number(version) || 0 };
    }

    /** null: Redis kullanılamadı, gönderim kirasız (yalnız Mongo claim'iyle) sürer */
    private async acquireVersionLeases(winners: any[], token: string): Promise<VersionLeaseDecision[] | null> {
        return this.versionLeaseCall('acquire', () => this.versionLeases.acquire(winners.map(e => this.leaseEntity(e)), token));
    }

    /** Redis hatası/zaman aşımı yutulur (null döner): kira yalnız çift gönderimi önler, gönderimi asla durdurmaz */
    private async versionLeaseCall<T>(operation: string, call: () => Promise<T>): Promise<T | null> {
        try {
            return await call();
        } catch (error) {
            EventMetrics.versionEventsLeaseUnavailableTotal.inc({ service: this.serviceLabel });
            const now = Date.now();
            if (now - this.lastLeaseWarnAt >= EventPublisherJob.VERSION_LEASE_WARN_INTERVAL) {
                this.lastLeaseWarnAt = now;
                logger.warn(`Version event Redis lease ${operation} failed; publishing with Mongo claim only`, {
                    error: (error as Error)?.message
                });
            }
            return null;
        }
    }

    private async monitorFailedEvents() {
        try {
            // Çok uzun süre processing durumunda kalan kayıtları pending'e çevir. Filtre güncellemenin içindedir:
            // arada başka pod'un kurtarıp yeniden aldığı (yeni processingStartedAt'lı) kayıt geri alınmaz.
            const now = Date.now();
            const stuckCutoff = new Date(now - EventPublisherJob.STUCK_PROCESSING_TIMEOUT);
            const fallbackFloor = new Date(now - EventPublisherJob.STUCK_FALLBACK_MAX_AGE);
            const recovered = await this.outboxModel.updateMany(
                {
                    status: 'processing',
                    $or: [
                        { processingStartedAt: { $lt: stuckCutoff } },
                        // UC-984: zaman damgası olmayan kayıt hiç kurtarılmıyordu; son 24 saattekiler updatedOn'a,
                        // updatedOn da yoksa creationDate'e göre kurtarılır (yalnız kendi environment'ı)
                        {
                            processingStartedAt: { $not: { $type: 'date' } },
                            environment: process.env.NODE_ENV || 'production',
                            $or: [
                                { updatedOn: { $lt: stuckCutoff, $gte: fallbackFloor } },
                                { updatedOn: { $not: { $type: 'date' } }, creationDate: { $lt: stuckCutoff, $gte: fallbackFloor } }
                            ]
                        }
                    ]
                },
                {
                    $set: { status: 'pending' },
                    $unset: { processingStartedAt: 1 }
                }
            );

            if (recovered.modifiedCount > 0) {
                logger.warn(`Recovered ${recovered.modifiedCount} stuck events from processing state`);
            }
            
            // Deneme hakkı kalan failed kayıtları bekleme süresi dolunca yeniden kuyruğa al (issue #648 K-1).
            // nextAttemptAt'i olmayan eski failed kayıtlar bilinçli olarak dışarıda kalır: birikmiş kayıtların
            // yeniden yayınlanması ayrı ve onaylı bir operasyondur.
            const requeued = await this.outboxModel.updateMany(
                {
                    status: 'failed',
                    environment: process.env.NODE_ENV || 'production',
                    retryCount: { $lt: EventPublisherJob.MAX_PUBLISH_ATTEMPTS },
                    nextAttemptAt: { $lte: new Date() }
                },
                {
                    $set: { status: 'pending' },
                    $unset: { nextAttemptAt: 1 }
                }
            );

            if (requeued.modifiedCount > 0) {
                logger.warn(`Requeued ${requeued.modifiedCount} failed events for another publish attempt`);
            }

            // Diğer mevcut monitoring kodları...
            const failedEvents = await this.outboxModel.countDocuments({
                status: 'failed',
                retryCount: { $gte: EventPublisherJob.MAX_PUBLISH_ATTEMPTS }
            });

            if (failedEvents < EventPublisherJob.ALERT_THRESHOLD) {
                // Kayıtlar temizlendi: eşik yeniden aşılırsa ALERT beklemeden loglanır
                this.lastAlertLoggedAt = null;
            } else if (this.lastAlertLoggedAt === null || Date.now() - this.lastAlertLoggedAt >= EventPublisherJob.ALERT_LOG_INTERVAL) {
                this.lastAlertLoggedAt = Date.now();
                logger.error(`ALERT: ${failedEvents} events have failed permanently!`);
                // Burada alert sisteminize bağlanabilirsiniz (Slack, Email, vs.)
            }
        } catch (error) {
            logger.error('Monitoring failed:', error);
        }
    }

    private async publishEvent(event: any) {
        switch (event.eventType) {
            case Subjects.ProductCreated:
                await new ProductCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.ProductUpdated:
                await new ProductUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            // Combination/PPL/RPL case'leri tamamen kaldırıldı (issue #507)
            case Subjects.UserCreated:
                await new UserCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.UserUpdated:
                await new UserUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.UserConfigUpdated:
                await new UserConfigUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.IntegrationCommand:
                await new IntegrationCommandPublisher(this.natsClient)
                    .publish({ requestId: event.id, ...event.payload });
                break;
            case Subjects.IntegrationCommandResult:
                await new IntegrationCommandResultPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.ProductStockCreated:
                await new ProductStockCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.ProductStockUpdated:
                await new ProductStockUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.StockCreated:
                await new StockCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.StockUpdated:
                await new StockUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.OrderCreated:
                await new OrderCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.OrderUpdated:
                await new OrderUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.OrderStatusUpdated:
                await new OrderStatusUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.EntityDeleted:
                await new EntityDeletedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.ProductIntegrationCreated:
                await new ProductIntegrationCreatedPublisher(this.natsClient)
                    .publish({ requestId: event.id, ...event.payload });
                break;
            case Subjects.ImportImagesFromUrls:
                await new ImportImagesFromUrlsPublisher(this.natsClient)
                    .publish(event.payload);
                    break;
            case Subjects.ImportImagesFromUrlsCompleted:
                await new ImportImagesFromUrlsCompletedPublisher(this.natsClient)
                    .publish(event.payload);
                    break;
            case Subjects.DeleteProductImages:
                await new DeleteProductImagesPublisher(this.natsClient)
                    .publish(event.payload);
                    break;
            case Subjects.DeleteProductImagesCompleted:
                await new DeleteProductImagesCompletedPublisher(this.natsClient)
                    .publish(event.payload);
                    break;
            case Subjects.ProductPriceIntegrationUpdated:
                await new ProductPriceIntegrationUpdatedPublisher(this.natsClient)
                    .publish({ requestId: event.id, ...event.payload });
                    break;
            case Subjects.ProductPriceUpdated:
                await new ProductPriceUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                    break;
            case Subjects.ProductCostUpdated:
                await new ProductCostUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                    break;
            case Subjects.OrderProductCostAssigned:
                await new OrderProductCostAssignedPublisher(this.natsClient)
                    .publish(event.payload);
                    break;
            case Subjects.ProductErpIdUpdated:
                await new ProductErpIdUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                    break;
            case Subjects.ProductStockIntegrationUpdated:
                await new ProductStockIntegrationUpdatedPublisher(this.natsClient)
                    .publish({ requestId: event.id, ...event.payload });
                    break;
            case Subjects.ProductImageIntegrationUpdated:
                await new ProductImageIntegrationUpdatedPublisher(this.natsClient)
                    .publish({ requestId: event.id, ...event.payload });
                    break;
            case Subjects.CatalogMappingCreated:
                await new CatalogMappingCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                    break;
            case Subjects.ProductIntegrationSynced:
                await new ProductIntegrationSyncedPublisher(this.natsClient)
                    .publish(event.payload);
                    break;
            case Subjects.OrderIntegrationCreated:
                await new OrderIntegrationCreatedPublisher(this.natsClient)
                    .publish({ requestId: event.id, ...event.payload });
                    break;
            case Subjects.IntegrationCreated:
                await new IntegrationCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.IntegrationUpdated:
                await new IntegrationUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.UserIntegrationSettings:
                await new UserIntegrationSettingsPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.OrderIntegrationStatusUpdated:
                await new OrderIntegrationStatusUpdatedPublisher(this.natsClient)
                    .publish({ requestId: event.id, ...event.payload });
                break;
            case Subjects.ProductMatched:
                await new ProductMatchedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.NotificationCreated:
                await new NotificationCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.NewsletterEmailRequested:
                await new NewsletterEmailRequestedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.UserSessionsRevoked:
                await new UserSessionsRevokedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.OrderProductUpdated:
                await new OrderProductStockUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.EntityVersionUpdated:
                await new EntityVersionUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.SyncRequested:
                await new SyncRequestedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.InvoiceCreated:
                await new InvoiceCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.InvoiceUpdated:
                await new InvoiceUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.InvoiceFormalized:
                await new InvoiceFormalizedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.InvoiceFailed:
                await new InvoiceFailedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            // OrderCargoUpdated case tamamen kaldırıldı (issue #507)
            case Subjects.ShipmentCreated:
                await new ShipmentCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.ShipmentUpdated:
                await new ShipmentUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.ExcelFileGenerated:
                await new ExcelFileGeneratedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.ExcelFileStored:
                await new ExcelFileStoredPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.PlatformCategorySynced:
                await new PlatformCategorySyncedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.PlatformBrandSynced:
                await new PlatformBrandSyncedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.CategoryCreated:
                await new CategoryCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.CategoryUpdated:
                await new CategoryUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.BrandCreated:
                await new BrandCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.BrandUpdated:
                await new BrandUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.CustomerUpdated:
                await new CustomerUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.CustomerAddressUpdated:
                await new CustomerAddressUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.CatalogMappingUpdated:
                await new CatalogMappingUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.UpdateOrderCargoLabel:
                await new UpdateOrderCargoLabelPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.OrderWorkPackageInfoBulkUpdated:
                await new OrderWorkPackageInfoBulkUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.SubscriptionUpdated:
                await new SubscriptionUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.SubscriptionPaymentCompleted:
                await new SubscriptionPaymentCompletedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            // DEPRECATED (issue #507) — Listener yok, outbox oluşturan kod kaldırıldı
            case Subjects.SubscriptionPaymentFailed:
                await new SubscriptionPaymentFailedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            // DEPRECATED (issue #507) — Listener yok, outbox oluşturan kod kaldırıldı
            case Subjects.SubscriptionInvoiceCreated:
                await new SubscriptionInvoiceCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.PriceProcessingCompleted:
                await new PriceProcessingCompletedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.IntegrationAuthFailureExceeded:
                await new IntegrationAuthFailureExceededPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.StockUpdateConfirmed:
                await new StockUpdateConfirmedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.ProductPreMatchUpdated:
                await new ProductPreMatchUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.StockCountStarted:
                await new StockCountStartedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.StockCountFinished:
                await new StockCountFinishedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            default:
                throw new Error(`Unknown event type: ${event.eventType}`);
        }
    }
}