"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventPublisherJob = void 0;
const common_1 = require("../common/");
const outbox_schema_1 = require("../models/outbox.schema");
const productCreated_publisher_1 = require("../events/publishers/productCreated.publisher");
const productUpdated_publisher_1 = require("../events/publishers/productUpdated.publisher");
// Combination/PPL/RPL publisher import'ları kaldırıldı (issue #507)
const userCreated_publisher_1 = require("../events/publishers/userCreated.publisher");
const userUpdated_publisher_1 = require("../events/publishers/userUpdated.publisher");
const userConfigUpdated_publisher_1 = require("../events/publishers/userConfigUpdated.publisher");
const integrationCommand_publisher_1 = require("../events/publishers/integrationCommand.publisher");
const productStockCreated_publisher_1 = require("../events/publishers/productStockCreated.publisher");
const productStockUpdated_publisher_1 = require("../events/publishers/productStockUpdated.publisher");
const stockCreated_publisher_1 = require("../events/publishers/stockCreated.publisher");
const stockUpdated_publisher_1 = require("../events/publishers/stockUpdated.publisher");
const orderCreated_publisher_1 = require("../events/publishers/orderCreated.publisher");
const orderUpdated_publisher_1 = require("../events/publishers/orderUpdated.publisher");
const entityDeleted_publisher_1 = require("../events/publishers/entityDeleted.publisher");
const orderStatusUpdated_publisher_1 = require("../events/publishers/orderStatusUpdated.publisher");
const integrationCommandResult_publisher_1 = require("../events/publishers/integrationCommandResult.publisher");
const productIntegrationCreated_publisher_1 = require("../events/publishers/productIntegrationCreated.publisher");
const deleteProductImagesCompletedPublisher_publisher_1 = require("../events/publishers/deleteProductImagesCompletedPublisher.publisher");
const deleteProductImagesPublisher_publisher_1 = require("../events/publishers/deleteProductImagesPublisher.publisher");
const importImagesFromUrlsPublisher_publisher_1 = require("../events/publishers/importImagesFromUrlsPublisher.publisher");
const importImagesFromUrlsCompletedPublisher_publisher_1 = require("../events/publishers/importImagesFromUrlsCompletedPublisher.publisher");
const productPriceIntegrationUpdated_publisher_1 = require("../events/publishers/productPriceIntegrationUpdated.publisher");
const productPriceUpdated_publisher_1 = require("../events/publishers/productPriceUpdated.publisher");
const productCostUpdated_publisher_1 = require("../events/publishers/productCostUpdated.publisher");
const orderProductCostAssigned_publisher_1 = require("../events/publishers/orderProductCostAssigned.publisher");
const productErpIdUpdated_publisher_1 = require("../events/publishers/productErpIdUpdated.publisher");
const productStockIntegrationUpdated_publisher_1 = require("../events/publishers/productStockIntegrationUpdated.publisher");
const productImageIntegrationUpdated_publisher_1 = require("../events/publishers/productImageIntegrationUpdated.publisher");
const catalogMappingCreated_publisher_1 = require("../events/publishers/catalogMappingCreated.publisher");
const productIntegrationSynced_publisher_1 = require("../events/publishers/productIntegrationSynced.publisher");
const orderIntegrationCreated_publisher_1 = require("../events/publishers/orderIntegrationCreated.publisher");
const logger_service_1 = require("../services/logger.service");
const EventMetrics_1 = require("../metrics/EventMetrics");
const integrationCreated_publisher_1 = require("../events/publishers/integrationCreated.publisher");
const integrationUpdated_publisher_1 = require("../events/publishers/integrationUpdated.publisher");
const userIntegrationSettings_publisher_1 = require("../events/publishers/userIntegrationSettings.publisher");
const orderIntegrationStatusUpdated_publisher_1 = require("../events/publishers/orderIntegrationStatusUpdated.publisher");
const productMatched_publisher_1 = require("../events/publishers/productMatched.publisher");
const notificationCreated_publisher_1 = require("../events/publishers/notificationCreated.publisher");
const newsletterEmailRequested_publisher_1 = require("../events/publishers/newsletterEmailRequested.publisher");
const userSessionsRevoked_publisher_1 = require("../events/publishers/userSessionsRevoked.publisher");
const orderProductUpdated_publisher_1 = require("../events/publishers/orderProductUpdated.publisher");
const entityVersionUpdated_publisher_1 = require("../events/publishers/entityVersionUpdated.publisher");
const versionEventOutbox_util_1 = require("../utils/versionEventOutbox.util");
const versionEventLease_util_1 = require("../utils/versionEventLease.util");
const redisWrapper_service_1 = require("../services/redisWrapper.service");
const os_1 = __importDefault(require("os"));
const entityVersionBulkUpdated_publisher_1 = require("../events/publishers/entityVersionBulkUpdated.publisher");
const syncRequested_publisher_1 = require("../events/publishers/syncRequested.publisher");
const invoiceCreated_publisher_1 = require("../events/publishers/invoiceCreated.publisher");
const invoiceUpdated_publisher_1 = require("../events/publishers/invoiceUpdated.publisher");
const invoiceFormalized_publisher_1 = require("../events/publishers/invoiceFormalized.publisher");
const invoiceFailed_publisher_1 = require("../events/publishers/invoiceFailed.publisher");
// OrderCargoUpdatedPublisher kaldırıldı (issue #507)
const shipmentCreated_publisher_1 = require("../events/publishers/shipmentCreated.publisher");
const shipmentUpdated_publisher_1 = require("../events/publishers/shipmentUpdated.publisher");
const excelFileGenerated_publisher_1 = require("../events/publishers/excelFileGenerated.publisher");
const excelFileStored_publisher_1 = require("../events/publishers/excelFileStored.publisher");
const platformCategorySynced_publisher_1 = require("../events/publishers/platformCategorySynced.publisher");
const platformBrandSynced_publisher_1 = require("../events/publishers/platformBrandSynced.publisher");
const categoryCreated_publisher_1 = require("../events/publishers/categoryCreated.publisher");
const categoryUpdated_publisher_1 = require("../events/publishers/categoryUpdated.publisher");
const brandCreated_publisher_1 = require("../events/publishers/brandCreated.publisher");
const brandUpdated_publisher_1 = require("../events/publishers/brandUpdated.publisher");
const customerUpdated_publisher_1 = require("../events/publishers/customerUpdated.publisher");
const customerAddressUpdated_publisher_1 = require("../events/publishers/customerAddressUpdated.publisher");
const catalogMappingUpdated_publisher_1 = require("../events/publishers/catalogMappingUpdated.publisher");
const updateOrderCargoLabel_publisher_1 = require("../events/publishers/updateOrderCargoLabel.publisher");
const orderWorkPackageInfoBulkUpdated_publisher_1 = require("../events/publishers/orderWorkPackageInfoBulkUpdated.publisher");
const subscriptionUpdated_publisher_1 = require("../events/publishers/subscriptionUpdated.publisher");
const subscriptionPaymentCompleted_publisher_1 = require("../events/publishers/subscriptionPaymentCompleted.publisher");
const subscriptionPaymentFailed_publisher_1 = require("../events/publishers/subscriptionPaymentFailed.publisher");
const subscriptionInvoiceCreated_publisher_1 = require("../events/publishers/subscriptionInvoiceCreated.publisher");
const priceProcessingCompleted_publisher_1 = require("../events/publishers/priceProcessingCompleted.publisher");
const integrationAuthFailureExceeded_publisher_1 = require("../events/publishers/integrationAuthFailureExceeded.publisher");
const stockUpdateConfirmed_publisher_1 = require("../events/publishers/stockUpdateConfirmed.publisher");
const productPreMatchUpdated_publisher_1 = require("../events/publishers/productPreMatchUpdated.publisher");
const stockCountStarted_publisher_1 = require("../events/publishers/stockCountStarted.publisher");
const stockCountFinished_publisher_1 = require("../events/publishers/stockCountFinished.publisher");
class EventPublisherJob {
    constructor(natsClient, connection, serviceName // Optional: Thundering herd prevention için
    ) {
        this.natsClient = natsClient;
        this.connection = connection;
        this.intervalId = null;
        this.versionEventIntervalId = null; // Version eventleri için ayrı interval
        this.monitoringId = null;
        this.lastAlertLoggedAt = null; // Son ALERT logunun zamanı; sayı eşiğin altına inince sıfırlanır
        // Bir tur bir sonraki interval'e taşarsa ikinci tur başlamaz (aynı pod'da üst üste boşaltma yok)
        this.versionDrainRunning = false;
        this.normalDrainRunning = false;
        this.podId = process.env.HOSTNAME || os_1.default.hostname();
        this.lastLeaseWarnAt = 0;
        this.lastHintFallbackWarnAt = 0;
        // Kullanıcı bazlı son işlenen priority takibi (priority geçiş bekleme için)
        this.lastProcessedPriority = new Map();
        this.outboxModel = (0, outbox_schema_1.createOutboxModel)(connection);
        // Servis adını belirle: parametre > env > undefined
        const resolvedServiceName = serviceName || this.resolveServiceNameFromEnv();
        // Servis adından deterministik offset hesapla (0-2500ms arası)
        this.serviceOffset = this.calculateServiceOffset(resolvedServiceName);
        this.serviceLabel = resolvedServiceName || 'unknown';
        this.versionEventInterval = EventPublisherJob.readPositiveIntEnv('VERSION_EVENT_INTERVAL_MS', EventPublisherJob.VERSION_EVENT_INTERVAL_DEFAULT);
        this.versionBatchSize = Math.min(EventPublisherJob.readPositiveIntEnv('VERSION_EVENT_BATCH_SIZE', EventPublisherJob.VERSION_BATCH_SIZE_MAX), EventPublisherJob.VERSION_BATCH_SIZE_MAX);
        this.versionMaxBatchesPerTick = EventPublisherJob.readPositiveIntEnv('VERSION_EVENT_MAX_BATCHES_PER_TICK', EventPublisherJob.VERSION_MAX_BATCHES_PER_TICK_DEFAULT);
        this.normalDrainBudgetMs = EventPublisherJob.readNonNegativeIntEnv('OUTBOX_DRAIN_BUDGET_MS', EventPublisherJob.NORMAL_DRAIN_BUDGET_MS_DEFAULT);
        this.coalesceSubjects = EventPublisherJob.readCoalesceSubjects();
        this.versionLeases = new versionEventLease_util_1.VersionEventLeases(() => redisWrapper_service_1.redisWrapper.client, {
            leaseMs: EventPublisherJob.readPositiveIntEnv('VERSION_EVENT_LEASE_MS', EventPublisherJob.VERSION_LEASE_MS_DEFAULT),
            latestTtlMs: EventPublisherJob.readPositiveIntEnv('VERSION_EVENT_LATEST_TTL_MS', EventPublisherJob.VERSION_LATEST_TTL_MS_DEFAULT),
            timeoutMs: EventPublisherJob.readPositiveIntEnv('VERSION_EVENT_REDIS_TIMEOUT_MS', EventPublisherJob.VERSION_REDIS_TIMEOUT_MS_DEFAULT)
        });
        EventMetrics_1.EventMetrics.setOutboxCollector(this.serviceLabel, () => this.collectOutboxMetrics());
    }
    /**
     * Outbox gauge'ları için anlık durum (UC-984). Yayıncıyla aynı environment filtresi kullanılır:
     * paylaşımlı Mongo'daki development kayıtları canlı alarmına girmez.
     */
    async collectOutboxMetrics() {
        const environment = process.env.NODE_ENV || 'production';
        const now = Date.now();
        const versionFilter = { environment, eventType: common_1.Subjects.EntityVersionUpdated };
        const [pending, processing, failed, oldest, stuckProcessing, failedFinal] = await Promise.all([
            this.outboxModel.countDocuments(Object.assign(Object.assign({}, versionFilter), { status: 'pending' })),
            this.outboxModel.countDocuments(Object.assign(Object.assign({}, versionFilter), { status: 'processing' })),
            this.outboxModel.countDocuments(Object.assign(Object.assign({}, versionFilter), { status: 'failed' })),
            this.outboxModel.findOne(Object.assign(Object.assign({}, versionFilter), { status: { $in: ['pending', 'processing'] } }))
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
        const oldestCreated = oldest === null || oldest === void 0 ? void 0 : oldest.creationDate;
        return {
            versionRecords: { pending, processing, failed },
            versionOldestPendingAgeSeconds: oldestCreated ? Math.max(0, (now - new Date(oldestCreated).getTime()) / 1000) : 0,
            stuckProcessing,
            failedFinal
        };
    }
    /** Pozitif tam sayı env değeri; boş ya da geçersizse varsayılan. */
    static readPositiveIntEnv(name, fallback) {
        const value = Number(process.env[name]);
        return Number.isInteger(value) && value > 0 ? value : fallback;
    }
    /** Sıfır ya da pozitif tam sayı env değeri; boş ya da geçersizse varsayılan. */
    /**
     * UC-1135: yayın anında birleştirilecek olay tipleri (OUTBOX_COALESCE_SUBJECTS, virgüllü). Boş/yok = kapalı.
     * Yalnız COALESCIBLE_SUBJECTS içindeki tipler kabul edilir; listede olmayan tip (ör. sync:requested) sessizce yok sayılır.
     */
    static readCoalesceSubjects() {
        var _a;
        const requested = ((_a = process.env.OUTBOX_COALESCE_SUBJECTS) !== null && _a !== void 0 ? _a : '').split(',').map(s => s.trim()).filter(Boolean);
        return new Set(requested.filter(subject => EventPublisherJob.COALESCIBLE_SUBJECTS.includes(subject)));
    }
    static readNonNegativeIntEnv(name, fallback) {
        const raw = process.env[name];
        if (raw === undefined || raw.trim() === '')
            return fallback;
        const value = Number(raw);
        return Number.isInteger(value) && value >= 0 ? value : fallback;
    }
    /**
     * Environment variable'dan servis adını çöz
     */
    resolveServiceNameFromEnv() {
        const envServiceName = process.env.SERVICE_NAME;
        if (!envServiceName)
            return undefined;
        // ServiceName enum'unda ara (case-insensitive)
        const serviceValues = Object.values(common_1.ServiceName);
        const found = serviceValues.find(s => s.toLowerCase() === envServiceName.toLowerCase());
        return found;
    }
    /**
     * Servis adından deterministik offset hesapla
     * Bu sayede farklı servisler farklı zamanlarda çalışır (thundering herd prevention)
     */
    calculateServiceOffset(serviceName) {
        if (!serviceName)
            return 0;
        // ServiceName enum değerlerinin index'ini al (0-based)
        const serviceValues = Object.values(common_1.ServiceName);
        const serviceIndex = serviceValues.indexOf(serviceName);
        if (serviceIndex === -1)
            return 0;
        // Her servis için 300ms offset (8 servis = 0, 300, 600, 900, 1200, 1500, 1800, 2100ms)
        const offset = (serviceIndex % 8) * 300;
        return offset;
    }
    /**
     * Random jitter ekle (0-500ms)
     * Bu sayede aynı servisin farklı pod'ları bile aynı anda çalışmaz
     */
    getJitter() {
        return Math.floor(Math.random() * EventPublisherJob.MAX_JITTER);
    }
    async start() {
        // Servis bazlı offset + random jitter ile başlangıcı geciktir
        const initialDelay = this.serviceOffset + this.getJitter();
        logger_service_1.logger.info(`EventPublisherJob starting with offset=${this.serviceOffset}ms, initialDelay=${initialDelay}ms`);
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
            logger_service_1.logger.info(`EventPublisherJob started: normal=${EventPublisherJob.RETRY_INTERVAL}ms (drainBudget=${this.normalDrainBudgetMs}ms), version=${this.versionEventInterval}ms (batch=${this.versionBatchSize}, maxBatches=${this.versionMaxBatchesPerTick}), serviceOffset=${this.serviceOffset}ms`);
        }, initialDelay);
    }
    stop() {
        [this.intervalId, this.versionEventIntervalId, this.monitoringId].forEach(interval => {
            if (interval)
                clearInterval(interval);
        });
        this.intervalId = null;
        this.versionEventIntervalId = null;
        this.monitoringId = null;
        this.lastProcessedPriority.clear();
    }
    /**
     * TTL-based cleanup — eski veya aşırı büyümüş priority kayıtlarını temizle
     */
    cleanupPriorityMap() {
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
    async processEvents() {
        if (this.normalDrainRunning) {
            logger_service_1.logger.debug('Previous outbox drain is still running, skipping this tick');
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
                if (passPublished === 0)
                    break;
            } while (Date.now() < deadline);
            if (published > 0) {
                logger_service_1.logger.info(`Outbox drain: ${published} events in ${passes} passes`);
            }
        }
        finally {
            this.normalDrainRunning = false;
        }
    }
    /** Tek geçiş: _system_ olayları ya da en çok 10 kullanıcının en düşük priority'li olayları. Yayınlanan olay sayısını döndürür. */
    async processEventsOnce() {
        var _a;
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
                eventType: { $ne: common_1.Subjects.EntityVersionUpdated },
                $or: [
                    { userId: '_system_' },
                    { userId: { $exists: false } }, // Eski kayıtlar
                    { userId: null }
                ]
            })
                .sort({ priority: 1, creationDate: 1 })
                .limit(20);
            if (systemEvents.length > 0) {
                logger_service_1.logger.debug(`Processing ${systemEvents.length} _system_ events (highest priority)`);
                return await this.processEventBatch(systemEvents); // _system_ bitmeden diğerlerine geçme
            }
            // ✅ STEP 2: Her kullanıcı için sequential priority işleme
            const usersWithPendingEvents = await this.outboxModel.distinct('userId', {
                status: 'pending',
                environment: currentEnvironment,
                retryCount: { $lt: EventPublisherJob.MAX_PUBLISH_ATTEMPTS },
                eventType: { $ne: common_1.Subjects.EntityVersionUpdated },
                userId: { $nin: ['_system_', null] }
            });
            if (usersWithPendingEvents.length === 0) {
                return 0;
            }
            // Her kullanıcı için en yüksek öncelikli event'leri işle
            for (const userId of usersWithPendingEvents.slice(0, 10)) {
                // Priority sıralı event'leri al, en düşük priority'yi belirle
                const sortedEvents = await this.findUserEvents(userId, currentEnvironment);
                if (sortedEvents.length === 0)
                    continue;
                // İlk event'in priority'si = en düşük priority
                const currentPriority = (_a = sortedEvents[0].priority) !== null && _a !== void 0 ? _a : 3;
                // ✅ PRIORITY GEÇİŞ BEKLEMESİ: Önceki priority'den farklı bir priority'ye geçiyorsak bekle
                const lastProcessed = this.lastProcessedPriority.get(userId);
                if (lastProcessed && lastProcessed.priority < currentPriority) {
                    const timeSinceLastProcess = Date.now() - lastProcessed.timestamp;
                    const requiredWait = EventPublisherJob.PRIORITY_TRANSITION_DELAY;
                    if (timeSinceLastProcess < requiredWait) {
                        const remainingWait = requiredWait - timeSinceLastProcess;
                        logger_service_1.logger.info(`⏳ Priority transition wait for user ${userId}: priority ${lastProcessed.priority} → ${currentPriority}, waiting ${remainingWait}ms for listeners to complete`);
                        continue;
                    }
                    logger_service_1.logger.info(`✅ Priority transition complete for user ${userId}: ${lastProcessed.priority} → ${currentPriority} (waited ${timeSinceLastProcess}ms)`);
                }
                // ✅ Aynı priority'deki event'leri filtrele (tek sorgudan)
                const userEvents = sortedEvents.filter(e => {
                    var _a;
                    const ePriority = (_a = e.priority) !== null && _a !== void 0 ? _a : 3;
                    return ePriority === currentPriority;
                });
                if (userEvents.length > 0) {
                    logger_service_1.logger.debug(`Processing ${userEvents.length} priority-${currentPriority} events for user ${userId}`);
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
                        logger_service_1.logger.debug(`User ${userId} still has pending events (same priority: ${mightHaveMore ? '50+' : '0'}, other priorities: ${remainingCount})`);
                    }
                }
            }
        }
        catch (error) {
            logger_service_1.logger.error('Event processing failed:', error);
        }
        return published;
    }
    /**
     * Kullanıcının en düşük priority'li bekleyen olayları (UC-1117), en çok USER_EVENTS_LIMIT kayıt, priority ve
     * creationDate sırasıyla. İki sorgu, her biri kendi indeksine hint'li: önce priority 1-4 (ve priority'siz eski
     * kayıtlar), yoksa priority 5. Sürüm olayları ilk sorgunun indeks aralığına girmez, ikincide eventType sınırıyla
     * atlanır. İlk sorgu boş değilse sonuç tek sorgununkiyle aynıdır: sonraki adım yalnız en düşük priority'yi yayınlar.
     */
    async findUserEvents(userId, environment) {
        const filter = {
            status: 'pending',
            environment,
            retryCount: { $lt: EventPublisherJob.MAX_PUBLISH_ATTEMPTS },
            eventType: { $ne: common_1.Subjects.EntityVersionUpdated },
            userId,
        };
        const urgent = await this.findWithHint(Object.assign(Object.assign({}, filter), { priority: { $not: { $gte: 5 } } }), EventPublisherJob.USER_PRIORITY_INDEX);
        if (urgent.length > 0)
            return urgent;
        return this.findWithHint(Object.assign(Object.assign({}, filter), { priority: { $gte: 5 } }), EventPublisherJob.USER_EVENT_TYPE_INDEX);
    }
    /** İndeks yoksa ya da henüz kuruluyorsa Mongo hint'li sorguyu reddeder; yayın durmasın diye hint'siz yeniden sorgular. */
    async findWithHint(filter, index) {
        const query = () => this.outboxModel.find(filter).sort({ priority: 1, creationDate: 1 }).limit(EventPublisherJob.USER_EVENTS_LIMIT);
        try {
            return await query().hint(index).lean();
        }
        catch (error) {
            const now = Date.now();
            if (now - this.lastHintFallbackWarnAt >= EventPublisherJob.HINT_FALLBACK_WARN_INTERVAL) {
                this.lastHintFallbackWarnAt = now;
                logger_service_1.logger.warn(`Outbox query with index hint ${JSON.stringify(index)} failed, retrying without hint:`, error);
            }
            return query().lean();
        }
    }
    async processEventBatch(events) {
        const { toPublish, groups } = this.groupCoalescible(events);
        const claimedAt = new Date();
        if (groups.length > 0) {
            await this.claimLosers(groups, claimedAt);
        }
        let published = 0;
        const publishedIds = new Set();
        // Concurrency limit ile paralel işleme
        for (let i = 0; i < toPublish.length; i += EventPublisherJob.CONCURRENCY_LIMIT) {
            const chunk = toPublish.slice(i, i + EventPublisherJob.CONCURRENCY_LIMIT);
            const results = await Promise.all(chunk.map(async (event) => {
                const ok = await this.processOneEvent(event);
                if (ok)
                    publishedIds.add(event.id);
                return ok;
            }));
            published += results.filter(Boolean).length;
        }
        if (groups.length > 0) {
            await this.settleLosers(groups, publishedIds, claimedAt);
        }
        return published;
    }
    /**
     * UC-1135: bayraktaki tiplerde aynı (tip, kullanıcı, payload.id) için partideki en yüksek payload.version kazanır.
     * Eşit sürümde ilk gelen (en eski) kazanır. Sürümü/id'si olmayan kayıt birleşmez, olduğu gibi yayınlanır.
     * Bayrak kapalıyken toPublish = events (davranış değişmez).
     */
    groupCoalescible(events) {
        var _a;
        if (this.coalesceSubjects.size === 0) {
            return { toPublish: events, groups: [] };
        }
        const byKey = new Map();
        const toPublish = [];
        for (const event of events) {
            const payload = event.payload;
            if (!this.coalesceSubjects.has(event.eventType) || !(payload === null || payload === void 0 ? void 0 : payload.id) || typeof payload.version !== 'number') {
                toPublish.push(event);
                continue;
            }
            const key = [event.eventType, (_a = event.userId) !== null && _a !== void 0 ? _a : '', payload.id].join('|');
            const group = byKey.get(key);
            if (!group) {
                byKey.set(key, { winner: event, losers: [] });
            }
            else if (payload.version > group.winner.payload.version) {
                group.losers.push(group.winner);
                group.winner = event;
            }
            else {
                group.losers.push(event);
            }
        }
        const groups = [];
        for (const group of byKey.values()) {
            toPublish.push(group.winner);
            if (group.losers.length > 0)
                groups.push(group);
        }
        return { toPublish, groups };
    }
    /** Kaybedenleri claim et; başka pod'un aldığı satır dokunulmadan kalır (claimedAt filtresi sonraki adımda onu ayıklar). */
    async claimLosers(groups, claimedAt) {
        try {
            await this.outboxModel.updateMany({ _id: { $in: groups.flatMap(g => g.losers.map(e => e.id)) }, status: 'pending' }, { $set: { status: 'processing', processingStartedAt: claimedAt } });
        }
        catch (error) {
            // Claim düşerse kaybedenler pending kalır ve normal yoldan yayınlanır (kayıp yok)
            logger_service_1.logger.error('Failed to claim superseded stock events:', error);
        }
    }
    /**
     * Kazanan yayınlandıysa kaybedenler 'superseded' + supersededBy olur; yayınlanmadıysa pending'e döner.
     * Güncelleme düşerse kaybedenler processing'te kalır, monitorFailedEvents 5 dk sonra kurtarır (çift, kayıp değil).
     */
    async settleLosers(groups, publishedIds, claimedAt) {
        for (const { winner, losers } of groups) {
            const filter = { _id: { $in: losers.map(e => e.id) }, status: 'processing', processingStartedAt: claimedAt };
            try {
                if (publishedIds.has(winner.id)) {
                    const result = await this.outboxModel.updateMany(filter, { $set: { status: 'superseded', supersededBy: winner.id } });
                    EventMetrics_1.EventMetrics.outboxEventsCoalescedTotal.inc({ service: this.serviceLabel, event_type: winner.eventType }, result.modifiedCount);
                }
                else {
                    await this.outboxModel.updateMany(filter, { $set: { status: 'pending' }, $unset: { processingStartedAt: 1 } });
                }
            }
            catch (error) {
                logger_service_1.logger.error(`Failed to settle superseded events of ${winner.id}:`, error);
            }
        }
    }
    /** Olay bu çağrıda yayınlanıp published işaretlendiyse true. */
    async processOneEvent(event) {
        try {
            // Atomik güncelleme: pending durumundaki event'i processing olarak işaretle
            const claimedAt = new Date();
            const updated = await this.outboxModel.updateOne({
                _id: event.id,
                status: 'pending',
                retryCount: event.retryCount
            }, {
                $set: {
                    status: 'processing',
                    processingStartedAt: claimedAt
                }
            });
            // Event başka bir pod tarafından alınmış demektir, atla
            if (updated.modifiedCount === 0) {
                logger_service_1.logger.debug(`Event ${event.id} is already being processed by another publisher, skipping`);
                return false;
            }
            // Deneme hakkını yalnız yayın hatası tüketir; Mongo durum güncellemesi hataları aşağıdaki catch'e düşer
            try {
                await this.publishEvent(event);
            }
            catch (error) {
                // Önce logla: markPublishFailed'daki Mongo hatası dış catch'e düşer ve asıl yayın hatası kaybolmaz
                logger_service_1.logger.error(`Failed to publish event ${event.id}:`, error);
                await this.markPublishFailed({ _id: event.id, processingStartedAt: claimedAt }, event.retryCount);
                return false;
            }
            // Başarılı olarak işaretle
            await this.outboxModel.updateOne({ _id: event.id, status: 'processing', processingStartedAt: claimedAt }, { $set: { status: 'published' } });
            // UC-1117: olay başına satır debug'da; tur özeti processEvents'te info
            logger_service_1.logger.debug(`Successfully published event ${event.id} (priority: ${event.priority}, user: ${event.userId})`);
            return true;
        }
        catch (error) {
            logger_service_1.logger.error(`Failed to update outbox state of event ${event.id}:`, error);
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
    async markPublishFailed(filter, retryCount) {
        const attempts = retryCount + 1;
        const exhausted = attempts >= EventPublisherJob.MAX_PUBLISH_ATTEMPTS;
        const now = new Date();
        const result = await this.outboxModel.updateMany(Object.assign(Object.assign({}, filter), { status: 'processing', retryCount }), {
            $set: exhausted
                ? { status: 'failed', lastAttempt: now }
                : { status: 'failed', lastAttempt: now, nextAttemptAt: new Date(now.getTime() + this.getPublishRetryDelay(attempts)) },
            $inc: { retryCount: 1 }
        });
        if (exhausted && result.modifiedCount > 0) {
            logger_service_1.logger.error(`${result.modifiedCount} outbox event(s) permanently failed after ${attempts} publish attempts`, filter);
        }
    }
    /**
     * Başarısız denemeden sonraki bekleme: 30 sn, 60 sn, 120 sn, 240 sn (üst sınır 4 dk).
     * Beklemeler toplam 7,5 dk; publisher'ların kendi iç denemeleriyle (~10 sn × 5) kayıt ~8 dk'lık
     * NATS kesintisinden sonra kalıcı failed olur.
     */
    getPublishRetryDelay(attempts) {
        return Math.min(EventPublisherJob.PUBLISH_RETRY_BASE_DELAY * Math.pow(2, attempts - 1), EventPublisherJob.PUBLISH_RETRY_MAX_DELAY);
    }
    /**
     * EntityVersionUpdated eventlerini biriktirip BULK olarak publish eder.
     * Ayrı bir interval ile çalışır (varsayılan 2 dk). Her tur, kuyruk boşalana ya da
     * versionMaxBatchesPerTick partiye gelene kadar en fazla versionBatchSize olaylık
     * EntityVersionBulkUpdated mesajları gönderir (UC-984). Mesaj biçimi değişmedi: eski ve yeni
     * pod'lar aynı kuyruktan atomik claim ile birlikte yayın yapabilir.
     */
    async processVersionEventsAsBulk() {
        if (this.versionDrainRunning) {
            logger_service_1.logger.debug('Previous version event drain is still running, skipping this tick');
            return;
        }
        this.versionDrainRunning = true;
        try {
            let batches = 0;
            let published = 0;
            // İletimde olduğu için pending'e geri bırakılan kayıtlar bu turda yeniden alınmaz (aynı satırlar üzerinde dönme yok)
            const deferredIds = new Set();
            while (batches < this.versionMaxBatchesPerTick) {
                const result = await this.publishVersionEventBatch(deferredIds);
                batches++;
                published += result.published;
                if (!result.more)
                    break;
            }
            if (published > 0) {
                logger_service_1.logger.info(`🔄 Version event drain: ${published} events in ${batches} batches`);
            }
        }
        finally {
            this.versionDrainRunning = false;
        }
    }
    /**
     * Tek parti: en eski versionBatchSize kaydı claim edip tek NATS mesajıyla yayınlar.
     * `more`: kuyrukta kayıt kalmış olabilir ve yayın başarılı — aynı turda bir parti daha denenebilir.
     */
    async publishVersionEventBatch(deferredIds = new Set()) {
        var _a, _b, _c, _d, _e;
        try {
            const currentEnvironment = process.env.NODE_ENV || 'production';
            // Sadece EntityVersionUpdated eventlerini al
            const candidates = await this.outboxModel.find(Object.assign(Object.assign({}, (deferredIds.size > 0 ? { _id: { $nin: [...deferredIds] } } : {})), { status: 'pending', environment: currentEnvironment, retryCount: { $lt: EventPublisherJob.MAX_PUBLISH_ATTEMPTS }, eventType: common_1.Subjects.EntityVersionUpdated }))
                .sort({ creationDate: 1 })
                .limit(this.versionBatchSize);
            if (candidates.length === 0) {
                return { published: 0, more: false }; // İşlenecek event yok
            }
            const fullBatch = candidates.length === this.versionBatchSize;
            const candidateIds = candidates.map(e => e.id);
            const claimedAt = new Date();
            // Atomik olarak tüm eventleri 'processing' yap
            const updateResult = await this.outboxModel.updateMany({
                _id: { $in: candidateIds },
                status: 'pending'
            }, {
                $set: {
                    status: 'processing',
                    processingStartedAt: claimedAt
                }
            });
            // Bazı eventler başka pod tarafından alınmış olabilir
            if (updateResult.modifiedCount === 0) {
                logger_service_1.logger.debug('All version events already being processed by another publisher');
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
            const winners = new Map();
            for (const versionEvent of versionEvents) {
                const key = (0, versionEventOutbox_util_1.versionEventKey)(versionEvent.payload);
                const current = winners.get(key);
                if (!current || ((_b = (_a = versionEvent.payload) === null || _a === void 0 ? void 0 : _a.version) !== null && _b !== void 0 ? _b : 0) > ((_d = (_c = current.payload) === null || _c === void 0 ? void 0 : _c.version) !== null && _d !== void 0 ? _d : 0)) {
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
            const inflightKeys = new Set(winnerList.filter((_, i) => (decisions === null || decisions === void 0 ? void 0 : decisions[i]) === 'inflight').map(e => (0, versionEventOutbox_util_1.versionEventKey)(e.payload)));
            const deliveredKeys = new Set(winnerList.filter((_, i) => (decisions === null || decisions === void 0 ? void 0 : decisions[i]) === 'delivered').map(e => (0, versionEventOutbox_util_1.versionEventKey)(e.payload)));
            // İletimde olan varlığın satırları pending'e geri döner (retryCount artmaz); sonraki turda gönderilir
            const deferred = versionEvents.filter(e => inflightKeys.has((0, versionEventOutbox_util_1.versionEventKey)(e.payload)));
            if (deferred.length > 0) {
                await this.outboxModel.updateMany({ _id: { $in: deferred.map(e => e._id) }, status: 'processing', processingStartedAt: claimedAt }, { $set: { status: 'pending' }, $unset: { processingStartedAt: 1 } });
                deferred.forEach(e => deferredIds.add(e.id));
                EventMetrics_1.EventMetrics.versionEventsDuplicatePreventedTotal.inc({ service: this.serviceLabel, reason: 'inflight' }, deferred.length);
            }
            // Bu sürüm ya da daha yenisi sync'e zaten gönderilmiş: gönderilmez, iz için 'superseded'
            const alreadyDelivered = versionEvents.filter(e => deliveredKeys.has((0, versionEventOutbox_util_1.versionEventKey)(e.payload)));
            if (alreadyDelivered.length > 0) {
                await this.outboxModel.updateMany({ _id: { $in: alreadyDelivered.map(e => e._id) }, status: 'processing', processingStartedAt: claimedAt }, [{ $set: { status: 'superseded', supersededBy: { $concat: ['delivered:v', { $toString: '$payload.version' }] } } }]);
                EventMetrics_1.EventMetrics.versionEventsDuplicatePreventedTotal.inc({ service: this.serviceLabel, reason: 'delivered' }, alreadyDelivered.length);
            }
            const sendKeys = new Set(toSend.map(e => (0, versionEventOutbox_util_1.versionEventKey)(e.payload)));
            const eventIds = toSend.map(e => e.id);
            const superseded = versionEvents.filter(e => sendKeys.has((0, versionEventOutbox_util_1.versionEventKey)(e.payload)) && winners.get((0, versionEventOutbox_util_1.versionEventKey)(e.payload)) !== e);
            logger_service_1.logger.debug(`🔄 Processing ${versionEvents.length} EntityVersionUpdated events as bulk (${toSend.length} sent, ${superseded.length} superseded, ${deferred.length} in flight elsewhere, ${alreadyDelivered.length} already delivered)`);
            if (toSend.length === 0) {
                return { published: 0, more: fullBatch };
            }
            EventMetrics_1.EventMetrics.versionEventsInflight.set({ service: this.serviceLabel }, leased.length);
            try {
                // Bulk payload oluştur
                const bulkPayload = {
                    updates: toSend.map(e => e.payload),
                    batchId,
                    batchSize: toSend.length,
                    timestamp: new Date()
                };
                // TEK NATS mesajı gönder
                await new entityVersionBulkUpdated_publisher_1.EntityVersionBulkUpdatedPublisher(this.natsClient).publish(bulkPayload);
                EventMetrics_1.EventMetrics.outboxVersionEventsPublishedTotal.inc({ service: this.serviceLabel }, toSend.length);
                // Gönderilmiş sürüm Mongo işaretlemesinden ÖNCE yazılır: işaretleme düşüp kayıt yeniden kuyruğa girerse
                // aynı sürüm ikinci kez gönderilmez ('delivered'). Redis hatası yayını geri almaz.
                if (leased.length > 0) {
                    await this.versionLeaseCall('mark delivered', () => this.versionLeases.markDelivered(leased.map(e => this.leaseEntity(e))));
                }
                // Yalnız bu turun claim'i published olur (kurtarılıp başka pod'ca yeniden alınmış kayıt değil).
                // Bu güncelleme düşerse kayıtlar processing'te kalır, 5 dk sonra yeniden yayınlanır (çift, kayıp değil).
                await this.outboxModel.updateMany({ _id: { $in: eventIds }, status: 'processing', processingStartedAt: claimedAt }, { $set: { status: 'published' } });
                // Geride kalan sürümler silinmez: iz ve sayım için 'superseded' + gönderilen satırın kimliği.
                // Yayından SONRA işaretlenir: yayın düşerse hepsi failed olur, sonraki turda yeniden toplanır.
                if (superseded.length > 0) {
                    await this.outboxModel.bulkWrite(superseded.map(e => ({
                        updateOne: {
                            filter: { _id: e._id, status: 'processing', processingStartedAt: claimedAt },
                            update: { $set: { status: 'superseded', supersededBy: winners.get((0, versionEventOutbox_util_1.versionEventKey)(e.payload)).id } }
                        }
                    })), { ordered: false });
                    EventMetrics_1.EventMetrics.versionEventsCoalescedTotal.inc({ service: this.serviceLabel, stage: 'send' }, superseded.length);
                }
                logger_service_1.logger.debug(`✅ Bulk published ${toSend.length} EntityVersionUpdated events (batch: ${batchId})`);
                return { published: toSend.length, more: fullBatch };
            }
            catch (error) {
                // Önce logla: işaretleme sırasındaki Mongo hatası asıl yayın hatasını gizlemesin
                logger_service_1.logger.error('❌ Failed to publish bulk EntityVersionUpdated events:', error);
                // Hata durumunda tümünü 'failed' yap; bekleme ve kalıcı başarısızlık kaydın kendi retryCount'una göre belirlenir
                const idsByRetryCount = new Map();
                for (const versionEvent of versionEvents) {
                    const ids = (_e = idsByRetryCount.get(versionEvent.retryCount)) !== null && _e !== void 0 ? _e : [];
                    ids.push(versionEvent.id);
                    idsByRetryCount.set(versionEvent.retryCount, ids);
                }
                for (const [retryCount, ids] of idsByRetryCount) {
                    await this.markPublishFailed({ _id: { $in: ids }, processingStartedAt: claimedAt }, retryCount);
                }
                // Yayın başarısız: bu turda başka parti denenmez (NATS sorunluysa yükü büyütme)
                return { published: 0, more: false };
            }
            finally {
                // Kira yalnız sahibince bırakılır; yayın ve işaretleme bittikten (ya da hata verdikten) sonra
                if (leased.length > 0) {
                    const expired = await this.versionLeaseCall('release', () => this.versionLeases.release(leased.map(e => this.leaseEntity(e)), leaseToken));
                    if (expired) {
                        EventMetrics_1.EventMetrics.versionEventsLeaseExpiredTotal.inc({ service: this.serviceLabel }, expired);
                        logger_service_1.logger.warn(`Version event lease expired before publish finished for ${expired} entities (batch: ${batchId}); increase VERSION_EVENT_LEASE_MS`);
                    }
                }
                EventMetrics_1.EventMetrics.versionEventsInflight.set({ service: this.serviceLabel }, 0);
            }
        }
        catch (error) {
            logger_service_1.logger.error('Version event bulk processing failed:', error);
            return { published: 0, more: false };
        }
    }
    leaseEntity(versionEvent) {
        var _a;
        const { entityType, entityId, service, version } = (_a = versionEvent.payload) !== null && _a !== void 0 ? _a : {};
        return { entityType: String(entityType), entityId: String(entityId), service: String(service), version: Number(version) || 0 };
    }
    /** null: Redis kullanılamadı, gönderim kirasız (yalnız Mongo claim'iyle) sürer */
    async acquireVersionLeases(winners, token) {
        return this.versionLeaseCall('acquire', () => this.versionLeases.acquire(winners.map(e => this.leaseEntity(e)), token));
    }
    /** Redis hatası/zaman aşımı yutulur (null döner): kira yalnız çift gönderimi önler, gönderimi asla durdurmaz */
    async versionLeaseCall(operation, call) {
        try {
            return await call();
        }
        catch (error) {
            EventMetrics_1.EventMetrics.versionEventsLeaseUnavailableTotal.inc({ service: this.serviceLabel });
            const now = Date.now();
            if (now - this.lastLeaseWarnAt >= EventPublisherJob.VERSION_LEASE_WARN_INTERVAL) {
                this.lastLeaseWarnAt = now;
                logger_service_1.logger.warn(`Version event Redis lease ${operation} failed; publishing with Mongo claim only`, {
                    error: error === null || error === void 0 ? void 0 : error.message
                });
            }
            return null;
        }
    }
    async monitorFailedEvents() {
        try {
            // Çok uzun süre processing durumunda kalan kayıtları pending'e çevir. Filtre güncellemenin içindedir:
            // arada başka pod'un kurtarıp yeniden aldığı (yeni processingStartedAt'lı) kayıt geri alınmaz.
            const now = Date.now();
            const stuckCutoff = new Date(now - EventPublisherJob.STUCK_PROCESSING_TIMEOUT);
            const fallbackFloor = new Date(now - EventPublisherJob.STUCK_FALLBACK_MAX_AGE);
            const environment = process.env.NODE_ENV || 'production';
            const recovered = await this.outboxModel.updateMany({
                status: 'processing',
                // UC-1070: paylaşımlı Mongo'da başka environment'ın claim'i geri alınmaz (iki dal için de geçerli)
                environment,
                $or: [
                    { processingStartedAt: { $lt: stuckCutoff } },
                    // UC-984: zaman damgası olmayan kayıt hiç kurtarılmıyordu; son 24 saattekiler updatedOn'a,
                    // updatedOn da yoksa creationDate'e göre kurtarılır
                    {
                        processingStartedAt: { $not: { $type: 'date' } },
                        $or: [
                            { updatedOn: { $lt: stuckCutoff, $gte: fallbackFloor } },
                            { updatedOn: { $not: { $type: 'date' } }, creationDate: { $lt: stuckCutoff, $gte: fallbackFloor } }
                        ]
                    }
                ]
            }, {
                $set: { status: 'pending' },
                $unset: { processingStartedAt: 1 }
            });
            if (recovered.modifiedCount > 0) {
                logger_service_1.logger.warn(`Recovered ${recovered.modifiedCount} stuck events from processing state`);
            }
            // Deneme hakkı kalan failed kayıtları bekleme süresi dolunca yeniden kuyruğa al (issue #648 K-1).
            // nextAttemptAt'i olmayan eski failed kayıtlar bilinçli olarak dışarıda kalır: birikmiş kayıtların
            // yeniden yayınlanması ayrı ve onaylı bir operasyondur.
            const requeued = await this.outboxModel.updateMany({
                status: 'failed',
                environment,
                retryCount: { $lt: EventPublisherJob.MAX_PUBLISH_ATTEMPTS },
                nextAttemptAt: { $lte: new Date() }
            }, {
                $set: { status: 'pending' },
                $unset: { nextAttemptAt: 1 }
            });
            if (requeued.modifiedCount > 0) {
                logger_service_1.logger.warn(`Requeued ${requeued.modifiedCount} failed events for another publish attempt`);
            }
            // Diğer mevcut monitoring kodları...
            // UC-1070: başka environment'ın kalıcı hataları bu pod'un ALERT'ine girmez
            const failedEvents = await this.outboxModel.countDocuments({
                environment,
                status: 'failed',
                retryCount: { $gte: EventPublisherJob.MAX_PUBLISH_ATTEMPTS }
            });
            if (failedEvents < EventPublisherJob.ALERT_THRESHOLD) {
                // Kayıtlar temizlendi: eşik yeniden aşılırsa ALERT beklemeden loglanır
                this.lastAlertLoggedAt = null;
            }
            else if (this.lastAlertLoggedAt === null || Date.now() - this.lastAlertLoggedAt >= EventPublisherJob.ALERT_LOG_INTERVAL) {
                this.lastAlertLoggedAt = Date.now();
                logger_service_1.logger.error(`ALERT: ${failedEvents} events have failed permanently!`);
                // Burada alert sisteminize bağlanabilirsiniz (Slack, Email, vs.)
            }
        }
        catch (error) {
            logger_service_1.logger.error('Monitoring failed:', error);
        }
    }
    async publishEvent(event) {
        switch (event.eventType) {
            case common_1.Subjects.ProductCreated:
                await new productCreated_publisher_1.ProductCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.ProductUpdated:
                await new productUpdated_publisher_1.ProductUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            // Combination/PPL/RPL case'leri tamamen kaldırıldı (issue #507)
            case common_1.Subjects.UserCreated:
                await new userCreated_publisher_1.UserCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.UserUpdated:
                await new userUpdated_publisher_1.UserUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.UserConfigUpdated:
                await new userConfigUpdated_publisher_1.UserConfigUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.IntegrationCommand:
                await new integrationCommand_publisher_1.IntegrationCommandPublisher(this.natsClient)
                    .publish(Object.assign({ requestId: event.id }, event.payload));
                break;
            case common_1.Subjects.IntegrationCommandResult:
                await new integrationCommandResult_publisher_1.IntegrationCommandResultPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.ProductStockCreated:
                await new productStockCreated_publisher_1.ProductStockCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.ProductStockUpdated:
                await new productStockUpdated_publisher_1.ProductStockUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.StockCreated:
                await new stockCreated_publisher_1.StockCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.StockUpdated:
                await new stockUpdated_publisher_1.StockUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.OrderCreated:
                await new orderCreated_publisher_1.OrderCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.OrderUpdated:
                await new orderUpdated_publisher_1.OrderUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.OrderStatusUpdated:
                await new orderStatusUpdated_publisher_1.OrderStatusUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.EntityDeleted:
                await new entityDeleted_publisher_1.EntityDeletedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.ProductIntegrationCreated:
                await new productIntegrationCreated_publisher_1.ProductIntegrationCreatedPublisher(this.natsClient)
                    .publish(Object.assign({ requestId: event.id }, event.payload));
                break;
            case common_1.Subjects.ImportImagesFromUrls:
                await new importImagesFromUrlsPublisher_publisher_1.ImportImagesFromUrlsPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.ImportImagesFromUrlsCompleted:
                await new importImagesFromUrlsCompletedPublisher_publisher_1.ImportImagesFromUrlsCompletedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.DeleteProductImages:
                await new deleteProductImagesPublisher_publisher_1.DeleteProductImagesPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.DeleteProductImagesCompleted:
                await new deleteProductImagesCompletedPublisher_publisher_1.DeleteProductImagesCompletedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.ProductPriceIntegrationUpdated:
                await new productPriceIntegrationUpdated_publisher_1.ProductPriceIntegrationUpdatedPublisher(this.natsClient)
                    .publish(Object.assign({ requestId: event.id }, event.payload));
                break;
            case common_1.Subjects.ProductPriceUpdated:
                await new productPriceUpdated_publisher_1.ProductPriceUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.ProductCostUpdated:
                await new productCostUpdated_publisher_1.ProductCostUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.OrderProductCostAssigned:
                await new orderProductCostAssigned_publisher_1.OrderProductCostAssignedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.ProductErpIdUpdated:
                await new productErpIdUpdated_publisher_1.ProductErpIdUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.ProductStockIntegrationUpdated:
                await new productStockIntegrationUpdated_publisher_1.ProductStockIntegrationUpdatedPublisher(this.natsClient)
                    .publish(Object.assign({ requestId: event.id }, event.payload));
                break;
            case common_1.Subjects.ProductImageIntegrationUpdated:
                await new productImageIntegrationUpdated_publisher_1.ProductImageIntegrationUpdatedPublisher(this.natsClient)
                    .publish(Object.assign({ requestId: event.id }, event.payload));
                break;
            case common_1.Subjects.CatalogMappingCreated:
                await new catalogMappingCreated_publisher_1.CatalogMappingCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.ProductIntegrationSynced:
                await new productIntegrationSynced_publisher_1.ProductIntegrationSyncedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.OrderIntegrationCreated:
                await new orderIntegrationCreated_publisher_1.OrderIntegrationCreatedPublisher(this.natsClient)
                    .publish(Object.assign({ requestId: event.id }, event.payload));
                break;
            case common_1.Subjects.IntegrationCreated:
                await new integrationCreated_publisher_1.IntegrationCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.IntegrationUpdated:
                await new integrationUpdated_publisher_1.IntegrationUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.UserIntegrationSettings:
                await new userIntegrationSettings_publisher_1.UserIntegrationSettingsPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.OrderIntegrationStatusUpdated:
                await new orderIntegrationStatusUpdated_publisher_1.OrderIntegrationStatusUpdatedPublisher(this.natsClient)
                    .publish(Object.assign({ requestId: event.id }, event.payload));
                break;
            case common_1.Subjects.ProductMatched:
                await new productMatched_publisher_1.ProductMatchedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.NotificationCreated:
                await new notificationCreated_publisher_1.NotificationCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.NewsletterEmailRequested:
                await new newsletterEmailRequested_publisher_1.NewsletterEmailRequestedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.UserSessionsRevoked:
                await new userSessionsRevoked_publisher_1.UserSessionsRevokedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.OrderProductUpdated:
                await new orderProductUpdated_publisher_1.OrderProductStockUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.EntityVersionUpdated:
                await new entityVersionUpdated_publisher_1.EntityVersionUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.SyncRequested:
                await new syncRequested_publisher_1.SyncRequestedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.InvoiceCreated:
                await new invoiceCreated_publisher_1.InvoiceCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.InvoiceUpdated:
                await new invoiceUpdated_publisher_1.InvoiceUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.InvoiceFormalized:
                await new invoiceFormalized_publisher_1.InvoiceFormalizedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.InvoiceFailed:
                await new invoiceFailed_publisher_1.InvoiceFailedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            // OrderCargoUpdated case tamamen kaldırıldı (issue #507)
            case common_1.Subjects.ShipmentCreated:
                await new shipmentCreated_publisher_1.ShipmentCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.ShipmentUpdated:
                await new shipmentUpdated_publisher_1.ShipmentUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.ExcelFileGenerated:
                await new excelFileGenerated_publisher_1.ExcelFileGeneratedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.ExcelFileStored:
                await new excelFileStored_publisher_1.ExcelFileStoredPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.PlatformCategorySynced:
                await new platformCategorySynced_publisher_1.PlatformCategorySyncedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.PlatformBrandSynced:
                await new platformBrandSynced_publisher_1.PlatformBrandSyncedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.CategoryCreated:
                await new categoryCreated_publisher_1.CategoryCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.CategoryUpdated:
                await new categoryUpdated_publisher_1.CategoryUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.BrandCreated:
                await new brandCreated_publisher_1.BrandCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.BrandUpdated:
                await new brandUpdated_publisher_1.BrandUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.CustomerUpdated:
                await new customerUpdated_publisher_1.CustomerUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.CustomerAddressUpdated:
                await new customerAddressUpdated_publisher_1.CustomerAddressUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.CatalogMappingUpdated:
                await new catalogMappingUpdated_publisher_1.CatalogMappingUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.UpdateOrderCargoLabel:
                await new updateOrderCargoLabel_publisher_1.UpdateOrderCargoLabelPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.OrderWorkPackageInfoBulkUpdated:
                await new orderWorkPackageInfoBulkUpdated_publisher_1.OrderWorkPackageInfoBulkUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.SubscriptionUpdated:
                await new subscriptionUpdated_publisher_1.SubscriptionUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.SubscriptionPaymentCompleted:
                await new subscriptionPaymentCompleted_publisher_1.SubscriptionPaymentCompletedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            // DEPRECATED (issue #507) — Listener yok, outbox oluşturan kod kaldırıldı
            case common_1.Subjects.SubscriptionPaymentFailed:
                await new subscriptionPaymentFailed_publisher_1.SubscriptionPaymentFailedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            // DEPRECATED (issue #507) — Listener yok, outbox oluşturan kod kaldırıldı
            case common_1.Subjects.SubscriptionInvoiceCreated:
                await new subscriptionInvoiceCreated_publisher_1.SubscriptionInvoiceCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.PriceProcessingCompleted:
                await new priceProcessingCompleted_publisher_1.PriceProcessingCompletedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.IntegrationAuthFailureExceeded:
                await new integrationAuthFailureExceeded_publisher_1.IntegrationAuthFailureExceededPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.StockUpdateConfirmed:
                await new stockUpdateConfirmed_publisher_1.StockUpdateConfirmedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.ProductPreMatchUpdated:
                await new productPreMatchUpdated_publisher_1.ProductPreMatchUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.StockCountStarted:
                await new stockCountStarted_publisher_1.StockCountStartedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.StockCountFinished:
                await new stockCountFinished_publisher_1.StockCountFinishedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            default:
                throw new Error(`Unknown event type: ${event.eventType}`);
        }
    }
}
exports.EventPublisherJob = EventPublisherJob;
EventPublisherJob.RETRY_INTERVAL = 3000; // 3 saniye (normal eventler için)
// UC-984: sürüm olayları 2 dk'da bir 100'lük tek parti gönderiliyordu (saatte en fazla 3.000); tepe üretimi
// 4.200–4.700/sa olunca kuyruk büyüyordu. Artık tur 5 sn'de bir çalışır ve kuyruk boşalana ya da parti tavanına
// gelene kadar partiler gönderir (bekleyen sürüm olayının yaşı tepe saatte de saniyeler mertebesinde kalır).
// Üçü de env ile ayarlanır; geçersiz değer varsayılana düşer.
EventPublisherJob.VERSION_EVENT_INTERVAL_DEFAULT = 5000; // 5 saniye
// Tek NATS mesajındaki olay sayısı tavanı (mesaj boyutu). Env ile küçültülebilir, büyütülemez.
EventPublisherJob.VERSION_BATCH_SIZE_MAX = 100;
EventPublisherJob.VERSION_MAX_BATCHES_PER_TICK_DEFAULT = 20; // tur başına en fazla 20×100 olay
// UC-984 madde 9: Redis iletim kirası. Kira, en uzun yayından (NATS + Mongo işaretleme) uzun ve takılı processing
// kurtarmasından (STUCK_PROCESSING_TIMEOUT) kısa olmalı: pod ölürse kira önce düşer, sonra kayıt yeniden kuyruğa girer.
EventPublisherJob.VERSION_LEASE_MS_DEFAULT = 60000; // 1 dakika
EventPublisherJob.VERSION_LATEST_TTL_MS_DEFAULT = 24 * 60 * 60000; // "gönderilmiş en son sürüm" 24 saat tutulur
EventPublisherJob.VERSION_REDIS_TIMEOUT_MS_DEFAULT = 1000; // Redis yanıt vermezse gönderim beklemez
EventPublisherJob.VERSION_LEASE_WARN_INTERVAL = 60000; // Redis yokken uyarı logu en fazla dakikada bir
EventPublisherJob.ALERT_THRESHOLD = 5; // 5 başarısız event alert eşiği
// Eşik aşılmış kaldıkça ALERT her pod'da en fazla bu aralıkla tekrar loglanır (izleme turu 3 sn'de bir koşar).
// Kalıcı failed olan her kayıt ayrıca olduğu anda markPublishFailed içinde loglanır.
EventPublisherJob.ALERT_LOG_INTERVAL = 15 * 60000; // 15 dakika
// Issue #648 K-1: bir kaydın job seviyesindeki yayın denemesi üst sınırı. Hakkı kalan başarısız kayıt
// bekleme süresi dolunca yeniden kuyruğa alınır (30 sn → 60 → 120 → 240 sn); son denemede kalıcı failed olur.
EventPublisherJob.MAX_PUBLISH_ATTEMPTS = 5;
EventPublisherJob.PUBLISH_RETRY_BASE_DELAY = 30000; // 30 saniye
EventPublisherJob.PUBLISH_RETRY_MAX_DELAY = 240000; // 4 dakika
EventPublisherJob.MAX_JITTER = 500; // 0-500ms random jitter
// processing'te kalan kayıt bu süreden sonra pending'e döner
EventPublisherJob.STUCK_PROCESSING_TIMEOUT = 5 * 60000; // 5 dakika
// UC-984: processingStartedAt'ı olmayan (ya da Date olmayan) processing kaydı updatedOn/creationDate'e göre
// kurtarılır; ama yalnız bu pencere içindekiler. Daha eskileri (Ocak–Mart birikimi) kendiliğinden yeniden
// yayınlanmaz: bayat olayın yeniden yayını ayrı ve onaylı bir operasyondur (scripts/ops kurtarma betiği).
EventPublisherJob.STUCK_FALLBACK_MAX_AGE = 24 * 60 * 60000; // 24 saat
// Metrikte "kendiliğinden kurtulmayacak" sayılan processing kaydı: otomatik kurtarmanın iki katı süre
EventPublisherJob.STUCK_METRIC_AGE = 2 * EventPublisherJob.STUCK_PROCESSING_TIMEOUT;
EventPublisherJob.PRIORITY_TRANSITION_DELAY = 5000; // 5 saniye - priority geçişlerinde bekleme
// UC-1082: normal olaylar 3 sn'de bir tek geçişle (kullanıcı başına 50 olay) yayınlanıyordu; tek kullanıcının
// tavanı ~1.000 olay/dk idi ve 10.000 siparişlik birikim 40 dk'da boşalıyordu. Tur artık bu bütçe dolana ya da
// kuyrukta yayınlanacak olay kalmayana kadar geçişi tekrarlar. 0 = eski tek geçiş davranışı (OUTBOX_DRAIN_BUDGET_MS).
EventPublisherJob.NORMAL_DRAIN_BUDGET_MS_DEFAULT = 2000;
EventPublisherJob.USER_EVENTS_LIMIT = 50;
// UC-1117: kullanıcı başı sorgunun indeksleri (outbox.schema.ts). Hint'siz tek sorguda planlayıcı, sürüm olayı
// birikiminde eventType'lı indeksi seçip önbelleğe alıyor; birikim iş olayına dönünce plan değişmiyor ve her
// geçiş binlerce bekleyen kaydı okuyup bellekte sıralıyordu (UC-1082 profili: sorgu başına ~12 bin belge).
EventPublisherJob.USER_PRIORITY_INDEX = { status: 1, environment: 1, userId: 1, priority: 1, creationDate: 1 };
EventPublisherJob.USER_EVENT_TYPE_INDEX = { status: 1, environment: 1, retryCount: 1, userId: 1, eventType: 1 };
EventPublisherJob.HINT_FALLBACK_WARN_INTERVAL = 60000; // hint'siz sorguya düşme uyarısı en fazla dakikada bir
EventPublisherJob.PRIORITY_MAP_TTL = 300000; // 5 dakika — bu süreden eski entry'ler temizlenir
EventPublisherJob.PRIORITY_MAP_MAX_SIZE = 2000; // Maksimum kullanıcı sayısı
/**
 * Event batch'ini işle — paralel, concurrency limit ile
 */
EventPublisherJob.CONCURRENCY_LIMIT = 5;
/** Her güncelleme tam durumu taşıyan, yalnız en yüksek sürümü anlamlı olan olay tipleri (payload.id + payload.version). */
EventPublisherJob.COALESCIBLE_SUBJECTS = [common_1.Subjects.ProductStockUpdated];
//# sourceMappingURL=eventPublisher.job.js.map