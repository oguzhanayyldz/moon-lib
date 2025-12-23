"use strict";
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
class EventPublisherJob {
    constructor(natsClient, connection) {
        this.natsClient = natsClient;
        this.connection = connection;
        this.intervalId = null;
        this.monitoringId = null;
        this.outboxModel = (0, outbox_schema_1.createOutboxModel)(connection);
    }
    async start() {
        // Event publishing job
        this.intervalId = setInterval(async () => {
            await this.processEvents();
        }, EventPublisherJob.RETRY_INTERVAL);
        // Monitoring job
        this.monitoringId = setInterval(async () => {
            await this.monitorFailedEvents();
        }, EventPublisherJob.RETRY_INTERVAL);
    }
    stop() {
        [this.intervalId, this.monitoringId].forEach(interval => {
            if (interval)
                clearInterval(interval);
        });
        this.intervalId = null;
        this.monitoringId = null;
    }
    async processEvents() {
        try {
            // Sadece bu environment'a ait pending eventleri al
            const currentEnvironment = process.env.NODE_ENV || 'production';
            const pendingEvents = await this.outboxModel.find({
                status: 'pending',
                environment: currentEnvironment,
                retryCount: { $lt: 5 }
            })
                .sort({ createdAt: 1 })
                .limit(50); // Artırıldı: Bulk sync event'leri için yeterli kapasite (26 brand chunks + diğer event'ler)
            if (pendingEvents.length > 0) {
                logger_service_1.logger.debug(`Processing ${pendingEvents.length} events for environment: ${currentEnvironment}`);
            }
            for (const event of pendingEvents) {
                try {
                    // Atomik güncelleme: pending durumundaki event'i processing olarak işaretle
                    // ve aynı zamanda versiyon kontrolü yap
                    const updated = await this.outboxModel.updateOne({
                        _id: event.id,
                        status: 'pending',
                        retryCount: event.retryCount // Versiyon kontrolü sağlar
                    }, {
                        $set: {
                            status: 'processing',
                            processingStartedAt: new Date()
                        }
                    });
                    // Event başka bir pod tarafından alınmış demektir, atla
                    if (updated.modifiedCount === 0) {
                        logger_service_1.logger.info(`Event ${event.id} is already being processed by another publisher, skipping`);
                        continue;
                    }
                    await this.publishEvent(event);
                    // Başarılı olarak işaretle
                    await this.outboxModel.updateOne({ _id: event.id, status: 'processing' }, { $set: { status: 'published' } });
                    logger_service_1.logger.info(`Successfully published event ${event.id}`);
                }
                catch (error) {
                    await this.outboxModel.updateOne({ _id: event.id, status: 'processing' }, {
                        $set: { status: 'failed', lastAttempt: new Date() },
                        $inc: { retryCount: 1 }
                    });
                    logger_service_1.logger.error(`Failed to publish event ${event.id}:`, error);
                }
            }
        }
        catch (error) {
            logger_service_1.logger.error('Event processing failed:', error);
        }
    }
    async monitorFailedEvents() {
        try {
            // Çok uzun süre processing durumunda kalan kayıtları kontrol et
            const stuckEvents = await this.outboxModel.find({
                status: 'processing',
                processingStartedAt: {
                    $lt: new Date(Date.now() - 5 * 60 * 1000) // 5 dakikadan eski 
                }
            });
            if (stuckEvents.length > 0) {
                logger_service_1.logger.warn(`Found ${stuckEvents.length} stuck events in processing state`);
                for (const event of stuckEvents) {
                    await this.outboxModel.updateOne({ _id: event.id, status: 'processing' }, {
                        $set: { status: 'pending' },
                        $unset: { processingStartedAt: 1 }
                    });
                }
            }
            // Diğer mevcut monitoring kodları...
            const failedEvents = await this.outboxModel.countDocuments({
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
            case common_1.Subjects.CombinationCreated:
                await new combinationCreated_publisher_1.CombinationCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.CombinationUpdated:
                await new combinationUpdated_publisher_1.CombinationUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.PackageProductLinkCreated:
                await new packageProductLinkCreated_publisher_1.PackageProductLinkCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.PackageProductLinkUpdated:
                await new packageProductLinkUpdated_publisher_1.PackageProductLinkUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.RelationProductLinkCreated:
                await new relationProductLinkCreated_publisher_1.RelationProductLinkCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.RelationProductLinkUpdated:
                await new relationProductLinkUpdated_publisher_1.RelationProductLinkUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.UserCreated:
                await new userCreated_publisher_1.UserCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case common_1.Subjects.UserUpdated:
                await new userUpdated_publisher_1.UserUpdatedPublisher(this.natsClient)
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
            case common_1.Subjects.OrderCargoUpdated:
                await new orderCargoUpdated_publisher_1.OrderCargoUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
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
            default:
                throw new Error(`Unknown event type: ${event.eventType}`);
        }
    }
}
exports.EventPublisherJob = EventPublisherJob;
EventPublisherJob.RETRY_INTERVAL = 3000; // 3 saniye (bulk sync için optimize edildi)
EventPublisherJob.ALERT_THRESHOLD = 5; // 5 başarısız event alert eşiği
//# sourceMappingURL=eventPublisher.job.js.map