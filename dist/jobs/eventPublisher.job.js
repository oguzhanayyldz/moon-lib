"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventPublisherJob = void 0;
const common_1 = require("../common/");
const outbox_schema_1 = require("../models/outbox.schema");
const productCreated_publisher_1 = require("../events/publishers/productCreated.publisher");
const productUpdated_publisher_1 = require("../events/publishers/productUpdated.publisher");
const packageProductLinkCreated_publisher_1 = require("../events/publishers/packageProductLinkCreated.publisher");
const packageProductLinkUpdated_publisher_1 = require("../events/publishers/packageProductLinkUpdated.publisher");
const relationProductLinkCreated_publisher_1 = require("../events/publishers/relationProductLinkCreated.publisher");
const relationProductLinkUpdated_publisher_1 = require("../events/publishers/relationProductLinkUpdated.publisher");
const combinationCreated_publisher_1 = require("../events/publishers/combinationCreated.publisher");
const combinationUpdated_publisher_1 = require("../events/publishers/combinationUpdated.publisher");
const userCreated_publisher_1 = require("../events/publishers/userCreated.publisher");
const userUpdated_publisher_1 = require("../events/publishers/userUpdated.publisher");
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
const productErpIdUpdated_publisher_1 = require("../events/publishers/productErpIdUpdated.publisher");
const productStockIntegrationUpdated_publisher_1 = require("../events/publishers/productStockIntegrationUpdated.publisher");
const productImageIntegrationUpdated_publisher_1 = require("../events/publishers/productImageIntegrationUpdated.publisher");
const catalogMappingCreated_publisher_1 = require("../events/publishers/catalogMappingCreated.publisher");
const productIntegrationSynced_publisher_1 = require("../events/publishers/productIntegrationSynced.publisher");
const orderIntegrationCreated_publisher_1 = require("../events/publishers/orderIntegrationCreated.publisher");
const logger_service_1 = require("../services/logger.service");
const integrationCreated_publisher_1 = require("../events/publishers/integrationCreated.publisher");
const integrationUpdated_publisher_1 = require("../events/publishers/integrationUpdated.publisher");
const userIntegrationSettings_publisher_1 = require("../events/publishers/userIntegrationSettings.publisher");
const orderIntegrationStatusUpdated_publisher_1 = require("../events/publishers/orderIntegrationStatusUpdated.publisher");
const productMatched_publisher_1 = require("../events/publishers/productMatched.publisher");
const notificationCreated_publisher_1 = require("../events/publishers/notificationCreated.publisher");
const orderProductUpdated_publisher_1 = require("../events/publishers/orderProductUpdated.publisher");
const entityVersionUpdated_publisher_1 = require("../events/publishers/entityVersionUpdated.publisher");
const entityVersionBulkUpdated_publisher_1 = require("../events/publishers/entityVersionBulkUpdated.publisher");
const syncRequested_publisher_1 = require("../events/publishers/syncRequested.publisher");
const invoiceCreated_publisher_1 = require("../events/publishers/invoiceCreated.publisher");
const invoiceUpdated_publisher_1 = require("../events/publishers/invoiceUpdated.publisher");
const invoiceFormalized_publisher_1 = require("../events/publishers/invoiceFormalized.publisher");
const invoiceFailed_publisher_1 = require("../events/publishers/invoiceFailed.publisher");
const orderCargoUpdated_publisher_1 = require("../events/publishers/orderCargoUpdated.publisher");
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
class EventPublisherJob {
    constructor(natsClient, connection, serviceName // Optional: Thundering herd prevention için
    ) {
        this.natsClient = natsClient;
        this.connection = connection;
        this.intervalId = null;
        this.versionEventIntervalId = null; // Version eventleri için ayrı interval
        this.monitoringId = null;
        // Kullanıcı bazlı son işlenen priority takibi (priority geçiş bekleme için)
        this.lastProcessedPriority = new Map();
        this.outboxModel = (0, outbox_schema_1.createOutboxModel)(connection);
        // Servis adını belirle: parametre > env > undefined
        const resolvedServiceName = serviceName || this.resolveServiceNameFromEnv();
        // Servis adından deterministik offset hesapla (0-2500ms arası)
        this.serviceOffset = this.calculateServiceOffset(resolvedServiceName);
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
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            // Servis bazlı offset + random jitter ile başlangıcı geciktir
            const initialDelay = this.serviceOffset + this.getJitter();
            logger_service_1.logger.info(`EventPublisherJob starting with offset=${this.serviceOffset}ms, initialDelay=${initialDelay}ms`);
            // İlk çalışmayı geciktir, sonra normal interval ile devam et
            setTimeout(() => {
                // Normal event publishing job (3 saniye)
                this.intervalId = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                    yield this.processEvents();
                }), EventPublisherJob.RETRY_INTERVAL);
                // Version event bulk publishing job (2 dakika - biriktirme için daha uzun)
                this.versionEventIntervalId = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                    yield this.processVersionEventsAsBulk();
                }), EventPublisherJob.VERSION_EVENT_INTERVAL);
                // Monitoring job
                this.monitoringId = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                    yield this.monitorFailedEvents();
                }), EventPublisherJob.RETRY_INTERVAL);
                logger_service_1.logger.info(`EventPublisherJob started: normal=${EventPublisherJob.RETRY_INTERVAL}ms, version=${EventPublisherJob.VERSION_EVENT_INTERVAL}ms, serviceOffset=${this.serviceOffset}ms`);
            }, initialDelay);
        });
    }
    stop() {
        [this.intervalId, this.versionEventIntervalId, this.monitoringId].forEach(interval => {
            if (interval)
                clearInterval(interval);
        });
        this.intervalId = null;
        this.versionEventIntervalId = null;
        this.monitoringId = null;
    }
    processEvents() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const currentEnvironment = process.env.NODE_ENV || 'production';
                // ✅ STEP 1: Önce _system_ kullanıcısının event'lerini işle (en yüksek öncelik)
                const systemEvents = yield this.outboxModel.find({
                    status: 'pending',
                    environment: currentEnvironment,
                    retryCount: { $lt: 5 },
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
                    yield this.processEventBatch(systemEvents);
                    return; // _system_ bitmeden diğerlerine geçme
                }
                // ✅ STEP 2: Her kullanıcı için sequential priority işleme
                const usersWithPendingEvents = yield this.outboxModel.distinct('userId', {
                    status: 'pending',
                    environment: currentEnvironment,
                    retryCount: { $lt: 5 },
                    eventType: { $ne: common_1.Subjects.EntityVersionUpdated },
                    userId: { $nin: ['_system_', null] }
                });
                if (usersWithPendingEvents.length === 0) {
                    return;
                }
                // Her kullanıcı için en yüksek öncelikli event'leri işle
                for (const userId of usersWithPendingEvents.slice(0, 10)) {
                    // Bu kullanıcının en düşük priority numarasını bul
                    const lowestPriorityEvent = yield this.outboxModel.findOne({
                        status: 'pending',
                        environment: currentEnvironment,
                        retryCount: { $lt: 5 },
                        eventType: { $ne: common_1.Subjects.EntityVersionUpdated },
                        userId: userId
                    })
                        .sort({ priority: 1 })
                        .select('priority')
                        .lean();
                    if (!lowestPriorityEvent)
                        continue;
                    // Priority null/undefined ise default 3 kabul et
                    const currentPriority = (_a = lowestPriorityEvent.priority) !== null && _a !== void 0 ? _a : 3;
                    // ✅ PRIORITY GEÇİŞ BEKLEMESİ: Önceki priority'den farklı bir priority'ye geçiyorsak bekle
                    const lastProcessed = this.lastProcessedPriority.get(userId);
                    if (lastProcessed && lastProcessed.priority < currentPriority) {
                        const timeSinceLastProcess = Date.now() - lastProcessed.timestamp;
                        const requiredWait = EventPublisherJob.PRIORITY_TRANSITION_DELAY;
                        if (timeSinceLastProcess < requiredWait) {
                            const remainingWait = requiredWait - timeSinceLastProcess;
                            logger_service_1.logger.info(`⏳ Priority transition wait for user ${userId}: priority ${lastProcessed.priority} → ${currentPriority}, waiting ${remainingWait}ms for listeners to complete`);
                            continue; // Bu cycle'da bu kullanıcıyı atla, sonraki cycle'da devam edilecek
                        }
                        logger_service_1.logger.info(`✅ Priority transition complete for user ${userId}: ${lastProcessed.priority} → ${currentPriority} (waited ${timeSinceLastProcess}ms)`);
                    }
                    // ✅ SADECE bu öncelik seviyesindeki event'leri al
                    // Priority null olanlar için: null == priority 3 gibi davran
                    const userEvents = yield this.outboxModel.find({
                        status: 'pending',
                        environment: currentEnvironment,
                        retryCount: { $lt: 5 },
                        eventType: { $ne: common_1.Subjects.EntityVersionUpdated },
                        userId: userId,
                        $or: [
                            { priority: currentPriority },
                            // Eski kayıtlar (priority yok): sadece currentPriority=3 ise işle
                            ...(currentPriority === 3 ? [
                                { priority: { $exists: false } },
                                { priority: null }
                            ] : [])
                        ]
                    })
                        .sort({ creationDate: 1 })
                        .limit(50);
                    if (userEvents.length > 0) {
                        logger_service_1.logger.debug(`Processing ${userEvents.length} priority-${currentPriority} events for user ${userId}`);
                        yield this.processEventBatch(userEvents);
                        // Son işlenen priority'yi güncelle
                        this.lastProcessedPriority.set(userId, {
                            priority: currentPriority,
                            timestamp: Date.now()
                        });
                        // ✅ Bu kullanıcı için hâlâ aynı priority'de pending var mı kontrol et
                        const remainingCount = yield this.outboxModel.countDocuments({
                            status: 'pending',
                            environment: currentEnvironment,
                            retryCount: { $lt: 5 },
                            eventType: { $ne: common_1.Subjects.EntityVersionUpdated },
                            userId: userId,
                            $or: [
                                { priority: currentPriority },
                                ...(currentPriority === 3 ? [
                                    { priority: { $exists: false } },
                                    { priority: null }
                                ] : [])
                            ]
                        });
                        if (remainingCount > 0) {
                            logger_service_1.logger.debug(`User ${userId} still has ${remainingCount} priority-${currentPriority} events, will continue next cycle`);
                        }
                    }
                }
            }
            catch (error) {
                logger_service_1.logger.error('Event processing failed:', error);
            }
        });
    }
    /**
     * Event batch'ini işle
     */
    processEventBatch(events) {
        return __awaiter(this, void 0, void 0, function* () {
            for (const event of events) {
                try {
                    // Atomik güncelleme: pending durumundaki event'i processing olarak işaretle
                    const updated = yield this.outboxModel.updateOne({
                        _id: event.id,
                        status: 'pending',
                        retryCount: event.retryCount
                    }, {
                        $set: {
                            status: 'processing',
                            processingStartedAt: new Date()
                        }
                    });
                    // Event başka bir pod tarafından alınmış demektir, atla
                    if (updated.modifiedCount === 0) {
                        logger_service_1.logger.debug(`Event ${event.id} is already being processed by another publisher, skipping`);
                        continue;
                    }
                    yield this.publishEvent(event);
                    // Başarılı olarak işaretle
                    yield this.outboxModel.updateOne({ _id: event.id, status: 'processing' }, { $set: { status: 'published' } });
                    logger_service_1.logger.info(`Successfully published event ${event.id} (priority: ${event.priority}, user: ${event.userId})`);
                }
                catch (error) {
                    yield this.outboxModel.updateOne({ _id: event.id, status: 'processing' }, {
                        $set: { status: 'failed', lastAttempt: new Date() },
                        $inc: { retryCount: 1 }
                    });
                    logger_service_1.logger.error(`Failed to publish event ${event.id}:`, error);
                }
            }
        });
    }
    /**
     * EntityVersionUpdated eventlerini biriktirip BULK olarak publish eder
     * Bu metod ayrı bir interval ile çalışır (10 saniye) ve birikmiş version
     * eventlerini tek bir EntityVersionBulkUpdated mesajı olarak gönderir
     */
    processVersionEventsAsBulk() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const currentEnvironment = process.env.NODE_ENV || 'production';
                // Sadece EntityVersionUpdated eventlerini al
                const versionEvents = yield this.outboxModel.find({
                    status: 'pending',
                    environment: currentEnvironment,
                    retryCount: { $lt: 5 },
                    eventType: common_1.Subjects.EntityVersionUpdated
                })
                    .sort({ createdAt: 1 })
                    .limit(100); // Version eventleri için daha yüksek limit
                if (versionEvents.length === 0) {
                    return; // İşlenecek event yok
                }
                logger_service_1.logger.info(`🔄 Processing ${versionEvents.length} EntityVersionUpdated events as bulk`);
                const eventIds = versionEvents.map(e => e.id);
                // Atomik olarak tüm eventleri 'processing' yap
                const updateResult = yield this.outboxModel.updateMany({
                    _id: { $in: eventIds },
                    status: 'pending'
                }, {
                    $set: {
                        status: 'processing',
                        processingStartedAt: new Date()
                    }
                });
                // Bazı eventler başka pod tarafından alınmış olabilir
                if (updateResult.modifiedCount === 0) {
                    logger_service_1.logger.debug('All version events already being processed by another publisher');
                    return;
                }
                try {
                    // Bulk payload oluştur
                    const batchId = `bulk-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
                    const bulkPayload = {
                        updates: versionEvents.map(e => e.payload),
                        batchId,
                        batchSize: versionEvents.length,
                        timestamp: new Date()
                    };
                    // TEK NATS mesajı gönder
                    yield new entityVersionBulkUpdated_publisher_1.EntityVersionBulkUpdatedPublisher(this.natsClient).publish(bulkPayload);
                    // Tümünü başarılı işaretle
                    yield this.outboxModel.updateMany({ _id: { $in: eventIds }, status: 'processing' }, { $set: { status: 'published' } });
                    logger_service_1.logger.info(`✅ Bulk published ${versionEvents.length} EntityVersionUpdated events (batch: ${batchId})`);
                }
                catch (error) {
                    // Hata durumunda tümünü 'failed' yap (retry için)
                    yield this.outboxModel.updateMany({ _id: { $in: eventIds }, status: 'processing' }, {
                        $set: { status: 'failed', lastAttempt: new Date() },
                        $inc: { retryCount: 1 }
                    });
                    logger_service_1.logger.error('❌ Failed to publish bulk EntityVersionUpdated events:', error);
                }
            }
            catch (error) {
                logger_service_1.logger.error('Version event bulk processing failed:', error);
            }
        });
    }
    monitorFailedEvents() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Çok uzun süre processing durumunda kalan kayıtları kontrol et
                const stuckEvents = yield this.outboxModel.find({
                    status: 'processing',
                    processingStartedAt: {
                        $lt: new Date(Date.now() - 5 * 60 * 1000) // 5 dakikadan eski 
                    }
                });
                if (stuckEvents.length > 0) {
                    logger_service_1.logger.warn(`Found ${stuckEvents.length} stuck events in processing state`);
                    for (const event of stuckEvents) {
                        yield this.outboxModel.updateOne({ _id: event.id, status: 'processing' }, {
                            $set: { status: 'pending' },
                            $unset: { processingStartedAt: 1 }
                        });
                    }
                }
                // Diğer mevcut monitoring kodları...
                const failedEvents = yield this.outboxModel.countDocuments({
                    status: 'failed',
                    retryCount: { $gte: 5 }
                });
                if (failedEvents >= EventPublisherJob.ALERT_THRESHOLD) {
                    logger_service_1.logger.error(`ALERT: ${failedEvents} events have failed permanently!`);
                    // Burada alert sisteminize bağlanabilirsiniz (Slack, Email, vs.)
                }
            }
            catch (error) {
                logger_service_1.logger.error('Monitoring failed:', error);
            }
        });
    }
    publishEvent(event) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (event.eventType) {
                case common_1.Subjects.ProductCreated:
                    yield new productCreated_publisher_1.ProductCreatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.ProductUpdated:
                    yield new productUpdated_publisher_1.ProductUpdatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.CombinationCreated:
                    yield new combinationCreated_publisher_1.CombinationCreatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.CombinationUpdated:
                    yield new combinationUpdated_publisher_1.CombinationUpdatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.PackageProductLinkCreated:
                    yield new packageProductLinkCreated_publisher_1.PackageProductLinkCreatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.PackageProductLinkUpdated:
                    yield new packageProductLinkUpdated_publisher_1.PackageProductLinkUpdatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.RelationProductLinkCreated:
                    yield new relationProductLinkCreated_publisher_1.RelationProductLinkCreatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.RelationProductLinkUpdated:
                    yield new relationProductLinkUpdated_publisher_1.RelationProductLinkUpdatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.UserCreated:
                    yield new userCreated_publisher_1.UserCreatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.UserUpdated:
                    yield new userUpdated_publisher_1.UserUpdatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.IntegrationCommand:
                    yield new integrationCommand_publisher_1.IntegrationCommandPublisher(this.natsClient)
                        .publish(Object.assign({ requestId: event.id }, event.payload));
                    break;
                case common_1.Subjects.IntegrationCommandResult:
                    yield new integrationCommandResult_publisher_1.IntegrationCommandResultPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.ProductStockCreated:
                    yield new productStockCreated_publisher_1.ProductStockCreatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.ProductStockUpdated:
                    yield new productStockUpdated_publisher_1.ProductStockUpdatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.StockCreated:
                    yield new stockCreated_publisher_1.StockCreatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.StockUpdated:
                    yield new stockUpdated_publisher_1.StockUpdatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.OrderCreated:
                    yield new orderCreated_publisher_1.OrderCreatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.OrderUpdated:
                    yield new orderUpdated_publisher_1.OrderUpdatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.OrderStatusUpdated:
                    yield new orderStatusUpdated_publisher_1.OrderStatusUpdatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.EntityDeleted:
                    yield new entityDeleted_publisher_1.EntityDeletedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.ProductIntegrationCreated:
                    yield new productIntegrationCreated_publisher_1.ProductIntegrationCreatedPublisher(this.natsClient)
                        .publish(Object.assign({ requestId: event.id }, event.payload));
                    break;
                case common_1.Subjects.ImportImagesFromUrls:
                    yield new importImagesFromUrlsPublisher_publisher_1.ImportImagesFromUrlsPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.ImportImagesFromUrlsCompleted:
                    yield new importImagesFromUrlsCompletedPublisher_publisher_1.ImportImagesFromUrlsCompletedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.DeleteProductImages:
                    yield new deleteProductImagesPublisher_publisher_1.DeleteProductImagesPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.DeleteProductImagesCompleted:
                    yield new deleteProductImagesCompletedPublisher_publisher_1.DeleteProductImagesCompletedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.ProductPriceIntegrationUpdated:
                    yield new productPriceIntegrationUpdated_publisher_1.ProductPriceIntegrationUpdatedPublisher(this.natsClient)
                        .publish(Object.assign({ requestId: event.id }, event.payload));
                    break;
                case common_1.Subjects.ProductPriceUpdated:
                    yield new productPriceUpdated_publisher_1.ProductPriceUpdatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.ProductErpIdUpdated:
                    yield new productErpIdUpdated_publisher_1.ProductErpIdUpdatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.ProductStockIntegrationUpdated:
                    yield new productStockIntegrationUpdated_publisher_1.ProductStockIntegrationUpdatedPublisher(this.natsClient)
                        .publish(Object.assign({ requestId: event.id }, event.payload));
                    break;
                case common_1.Subjects.ProductImageIntegrationUpdated:
                    yield new productImageIntegrationUpdated_publisher_1.ProductImageIntegrationUpdatedPublisher(this.natsClient)
                        .publish(Object.assign({ requestId: event.id }, event.payload));
                    break;
                case common_1.Subjects.CatalogMappingCreated:
                    yield new catalogMappingCreated_publisher_1.CatalogMappingCreatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.ProductIntegrationSynced:
                    yield new productIntegrationSynced_publisher_1.ProductIntegrationSyncedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.OrderIntegrationCreated:
                    yield new orderIntegrationCreated_publisher_1.OrderIntegrationCreatedPublisher(this.natsClient)
                        .publish(Object.assign({ requestId: event.id }, event.payload));
                    break;
                case common_1.Subjects.IntegrationCreated:
                    yield new integrationCreated_publisher_1.IntegrationCreatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.IntegrationUpdated:
                    yield new integrationUpdated_publisher_1.IntegrationUpdatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.UserIntegrationSettings:
                    yield new userIntegrationSettings_publisher_1.UserIntegrationSettingsPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.OrderIntegrationStatusUpdated:
                    yield new orderIntegrationStatusUpdated_publisher_1.OrderIntegrationStatusUpdatedPublisher(this.natsClient)
                        .publish(Object.assign({ requestId: event.id }, event.payload));
                    break;
                case common_1.Subjects.ProductMatched:
                    yield new productMatched_publisher_1.ProductMatchedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.NotificationCreated:
                    yield new notificationCreated_publisher_1.NotificationCreatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.OrderProductUpdated:
                    yield new orderProductUpdated_publisher_1.OrderProductStockUpdatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.EntityVersionUpdated:
                    yield new entityVersionUpdated_publisher_1.EntityVersionUpdatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.SyncRequested:
                    yield new syncRequested_publisher_1.SyncRequestedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.InvoiceCreated:
                    yield new invoiceCreated_publisher_1.InvoiceCreatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.InvoiceUpdated:
                    yield new invoiceUpdated_publisher_1.InvoiceUpdatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.InvoiceFormalized:
                    yield new invoiceFormalized_publisher_1.InvoiceFormalizedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.InvoiceFailed:
                    yield new invoiceFailed_publisher_1.InvoiceFailedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.OrderCargoUpdated:
                    yield new orderCargoUpdated_publisher_1.OrderCargoUpdatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.ShipmentCreated:
                    yield new shipmentCreated_publisher_1.ShipmentCreatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.ShipmentUpdated:
                    yield new shipmentUpdated_publisher_1.ShipmentUpdatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.ExcelFileGenerated:
                    yield new excelFileGenerated_publisher_1.ExcelFileGeneratedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.ExcelFileStored:
                    yield new excelFileStored_publisher_1.ExcelFileStoredPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.PlatformCategorySynced:
                    yield new platformCategorySynced_publisher_1.PlatformCategorySyncedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.PlatformBrandSynced:
                    yield new platformBrandSynced_publisher_1.PlatformBrandSyncedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.CategoryCreated:
                    yield new categoryCreated_publisher_1.CategoryCreatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.CategoryUpdated:
                    yield new categoryUpdated_publisher_1.CategoryUpdatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.BrandCreated:
                    yield new brandCreated_publisher_1.BrandCreatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.BrandUpdated:
                    yield new brandUpdated_publisher_1.BrandUpdatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.CustomerUpdated:
                    yield new customerUpdated_publisher_1.CustomerUpdatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.CustomerAddressUpdated:
                    yield new customerAddressUpdated_publisher_1.CustomerAddressUpdatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.CatalogMappingUpdated:
                    yield new catalogMappingUpdated_publisher_1.CatalogMappingUpdatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.UpdateOrderCargoLabel:
                    yield new updateOrderCargoLabel_publisher_1.UpdateOrderCargoLabelPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.OrderWorkPackageInfoBulkUpdated:
                    yield new orderWorkPackageInfoBulkUpdated_publisher_1.OrderWorkPackageInfoBulkUpdatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                default:
                    throw new Error(`Unknown event type: ${event.eventType}`);
            }
        });
    }
}
exports.EventPublisherJob = EventPublisherJob;
EventPublisherJob.RETRY_INTERVAL = 3000; // 3 saniye (normal eventler için)
EventPublisherJob.VERSION_EVENT_INTERVAL = 120000; // 2 dakika (version eventleri için - bulk biriktirme)
EventPublisherJob.ALERT_THRESHOLD = 5; // 5 başarısız event alert eşiği
EventPublisherJob.MAX_JITTER = 500; // 0-500ms random jitter
EventPublisherJob.PRIORITY_TRANSITION_DELAY = 5000; // 5 saniye - priority geçişlerinde bekleme
