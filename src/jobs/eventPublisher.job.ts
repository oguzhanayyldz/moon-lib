import mongoose from 'mongoose';
import { Stan } from 'node-nats-streaming';
import { Subjects, ServiceName } from '../common/';
import { createOutboxModel, OutboxModel } from '../models/outbox.schema';
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
import { ProductErpIdUpdatedPublisher } from '../events/publishers/productErpIdUpdated.publisher';
import { ProductStockIntegrationUpdatedPublisher } from '../events/publishers/productStockIntegrationUpdated.publisher';
import { ProductImageIntegrationUpdatedPublisher } from '../events/publishers/productImageIntegrationUpdated.publisher';
import { CatalogMappingCreatedPublisher } from '../events/publishers/catalogMappingCreated.publisher';
import { ProductIntegrationSyncedPublisher } from '../events/publishers/productIntegrationSynced.publisher';
import { OrderIntegrationCreatedPublisher } from '../events/publishers/orderIntegrationCreated.publisher';
import { logger } from '../services/logger.service';
import { IntegrationCreatedPublisher } from '../events/publishers/integrationCreated.publisher';
import { IntegrationUpdatedPublisher } from '../events/publishers/integrationUpdated.publisher';
import { UserIntegrationSettingsPublisher } from '../events/publishers/userIntegrationSettings.publisher';
import { OrderIntegrationStatusUpdatedPublisher } from '../events/publishers/orderIntegrationStatusUpdated.publisher';
import { ProductMatchedPublisher } from '../events/publishers/productMatched.publisher';
import { NotificationCreatedPublisher } from '../events/publishers/notificationCreated.publisher';
import { OrderProductStockUpdatedPublisher } from '../events/publishers/orderProductUpdated.publisher';
import { EntityVersionUpdatedPublisher } from '../events/publishers/entityVersionUpdated.publisher';
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


export class EventPublisherJob {
    private static readonly RETRY_INTERVAL = 3000; // 3 saniye (normal eventler için)
    private static readonly VERSION_EVENT_INTERVAL = 120000; // 2 dakika (version eventleri için - bulk biriktirme)
    private static readonly ALERT_THRESHOLD = 5; // 5 başarısız event alert eşiği
    private static readonly MAX_JITTER = 500; // 0-500ms random jitter
    private static readonly PRIORITY_TRANSITION_DELAY = 5000; // 5 saniye - priority geçişlerinde bekleme
    private intervalId: NodeJS.Timeout | null = null;
    private versionEventIntervalId: NodeJS.Timeout | null = null; // Version eventleri için ayrı interval
    private monitoringId: NodeJS.Timeout | null = null;
    private readonly outboxModel: OutboxModel;
    private readonly serviceOffset: number; // Servis bazlı offset (thundering herd prevention)
    
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

            // Version event bulk publishing job (2 dakika - biriktirme için daha uzun)
            this.versionEventIntervalId = setInterval(async () => {
                await this.processVersionEventsAsBulk();
            }, EventPublisherJob.VERSION_EVENT_INTERVAL);

            // Monitoring job
            this.monitoringId = setInterval(async () => {
                await this.monitorFailedEvents();
            }, EventPublisherJob.RETRY_INTERVAL);

            logger.info(`EventPublisherJob started: normal=${EventPublisherJob.RETRY_INTERVAL}ms, version=${EventPublisherJob.VERSION_EVENT_INTERVAL}ms, serviceOffset=${this.serviceOffset}ms`);
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

    private async processEvents() {
        try {
            // TTL-based cleanup — eski priority kayıtlarını temizle (bellek sızıntısı önleme)
            this.cleanupPriorityMap();

            const currentEnvironment = process.env.NODE_ENV || 'production';

            // ✅ STEP 1: Önce _system_ kullanıcısının event'lerini işle (en yüksek öncelik)
            const systemEvents = await this.outboxModel.find({
                status: 'pending',
                environment: currentEnvironment,
                retryCount: { $lt: 5 },
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
                await this.processEventBatch(systemEvents);
                return; // _system_ bitmeden diğerlerine geçme
            }

            // ✅ STEP 2: Her kullanıcı için sequential priority işleme
            const usersWithPendingEvents = await this.outboxModel.distinct('userId', {
                status: 'pending',
                environment: currentEnvironment,
                retryCount: { $lt: 5 },
                eventType: { $ne: Subjects.EntityVersionUpdated },
                userId: { $nin: ['_system_', null] }
            });

            if (usersWithPendingEvents.length === 0) {
                return;
            }

            // Her kullanıcı için en yüksek öncelikli event'leri işle
            for (const userId of usersWithPendingEvents.slice(0, 10)) {
                // ✅ TEK SORGU: Priority sıralı event'leri al, en düşük priority'yi belirle
                const sortedEvents = await this.outboxModel.find({
                    status: 'pending',
                    environment: currentEnvironment,
                    retryCount: { $lt: 5 },
                    eventType: { $ne: Subjects.EntityVersionUpdated },
                    userId: userId
                })
                .sort({ priority: 1, creationDate: 1 })
                .limit(50)
                .lean();

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
                    await this.processEventBatch(userEvents);

                    // Son işlenen priority'yi güncelle
                    this.lastProcessedPriority.set(userId, {
                        priority: currentPriority,
                        timestamp: Date.now()
                    });

                    // ✅ Ek sorguya gerek yok: 50 event aldık, hepsi aynı priority değilse
                    // veya tam 50 geldiyse, demek ki daha var
                    const remainingCount = sortedEvents.length - userEvents.length;
                    const mightHaveMore = userEvents.length === 50;

                    if (remainingCount > 0 || mightHaveMore) {
                        logger.debug(`User ${userId} still has pending events (same priority: ${mightHaveMore ? '50+' : '0'}, other priorities: ${remainingCount})`);
                    }
                }

            }
        } catch (error) {
            logger.error('Event processing failed:', error);
        }
    }


    /**
     * Event batch'ini işle — paralel, concurrency limit ile
     */
    private static readonly CONCURRENCY_LIMIT = 5;

    private async processEventBatch(events: any[]) {
        // Concurrency limit ile paralel işleme
        for (let i = 0; i < events.length; i += EventPublisherJob.CONCURRENCY_LIMIT) {
            const chunk = events.slice(i, i + EventPublisherJob.CONCURRENCY_LIMIT);
            await Promise.all(chunk.map(event => this.processOneEvent(event)));
        }
    }

    private async processOneEvent(event: any) {
        try {
            // Atomik güncelleme: pending durumundaki event'i processing olarak işaretle
            const updated = await this.outboxModel.updateOne(
                {
                    _id: event.id,
                    status: 'pending',
                    retryCount: event.retryCount
                },
                {
                    $set: {
                        status: 'processing',
                        processingStartedAt: new Date()
                    }
                }
            );

            // Event başka bir pod tarafından alınmış demektir, atla
            if (updated.modifiedCount === 0) {
                logger.debug(`Event ${event.id} is already being processed by another publisher, skipping`);
                return;
            }

            await this.publishEvent(event);

            // Başarılı olarak işaretle
            await this.outboxModel.updateOne(
                { _id: event.id, status: 'processing' },
                { $set: { status: 'published' } }
            );

            logger.info(`Successfully published event ${event.id} (priority: ${event.priority}, user: ${event.userId})`);
        } catch (error) {
            await this.outboxModel.updateOne(
                { _id: event.id, status: 'processing' },
                {
                    $set: { status: 'failed', lastAttempt: new Date() },
                    $inc: { retryCount: 1 }
                }
            );
            logger.error(`Failed to publish event ${event.id}:`, error);
        }
    }


    /**
     * EntityVersionUpdated eventlerini biriktirip BULK olarak publish eder
     * Bu metod ayrı bir interval ile çalışır (10 saniye) ve birikmiş version
     * eventlerini tek bir EntityVersionBulkUpdated mesajı olarak gönderir
     */
    private async processVersionEventsAsBulk() {
        try {
            const currentEnvironment = process.env.NODE_ENV || 'production';

            // Sadece EntityVersionUpdated eventlerini al
            const versionEvents = await this.outboxModel.find({
                status: 'pending',
                environment: currentEnvironment,
                retryCount: { $lt: 5 },
                eventType: Subjects.EntityVersionUpdated
            })
                .sort({ creationDate: 1 })
                .limit(100); // Version eventleri için daha yüksek limit

            if (versionEvents.length === 0) {
                return; // İşlenecek event yok
            }

            logger.info(`🔄 Processing ${versionEvents.length} EntityVersionUpdated events as bulk`);

            const eventIds = versionEvents.map(e => e.id);

            // Atomik olarak tüm eventleri 'processing' yap
            const updateResult = await this.outboxModel.updateMany(
                { 
                    _id: { $in: eventIds }, 
                    status: 'pending' 
                },
                { 
                    $set: { 
                        status: 'processing', 
                        processingStartedAt: new Date() 
                    } 
                }
            );

            // Bazı eventler başka pod tarafından alınmış olabilir
            if (updateResult.modifiedCount === 0) {
                logger.debug('All version events already being processed by another publisher');
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
                await new EntityVersionBulkUpdatedPublisher(this.natsClient).publish(bulkPayload);

                // Tümünü başarılı işaretle
                await this.outboxModel.updateMany(
                    { _id: { $in: eventIds }, status: 'processing' },
                    { $set: { status: 'published' } }
                );

                logger.info(`✅ Bulk published ${versionEvents.length} EntityVersionUpdated events (batch: ${batchId})`);
            } catch (error) {
                // Hata durumunda tümünü 'failed' yap (retry için)
                await this.outboxModel.updateMany(
                    { _id: { $in: eventIds }, status: 'processing' },
                    { 
                        $set: { status: 'failed', lastAttempt: new Date() },
                        $inc: { retryCount: 1 }
                    }
                );
                logger.error('❌ Failed to publish bulk EntityVersionUpdated events:', error);
            }
        } catch (error) {
            logger.error('Version event bulk processing failed:', error);
        }
    }

    private async monitorFailedEvents() {
        try {
            // Çok uzun süre processing durumunda kalan kayıtları kontrol et
            const stuckEvents = await this.outboxModel.find({
                status: 'processing',
                processingStartedAt: { 
                    $lt: new Date(Date.now() - 5 * 60 * 1000) // 5 dakikadan eski 
                }
            });
            
            if (stuckEvents.length > 0) {
                logger.warn(`Found ${stuckEvents.length} stuck events in processing state`);
                
                for (const event of stuckEvents) {
                    await this.outboxModel.updateOne(
                        { _id: event.id, status: 'processing' },
                        { 
                            $set: { status: 'pending' }, 
                            $unset: { processingStartedAt: 1 }
                        }
                    );
                }
            }
            
            // Diğer mevcut monitoring kodları...
            const failedEvents = await this.outboxModel.countDocuments({
                status: 'failed',
                retryCount: { $gte: 5 }
            });

            if (failedEvents >= EventPublisherJob.ALERT_THRESHOLD) {
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
            default:
                throw new Error(`Unknown event type: ${event.eventType}`);
        }
    }
}