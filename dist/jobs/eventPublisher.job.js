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
const platformCategoryCreated_publisher_1 = require("../events/publishers/platformCategoryCreated.publisher");
const platformCategoryUpdated_publisher_1 = require("../events/publishers/platformCategoryUpdated.publisher");
const platformBrandCreated_publisher_1 = require("../events/publishers/platformBrandCreated.publisher");
const platformBrandUpdated_publisher_1 = require("../events/publishers/platformBrandUpdated.publisher");
const categoryCreated_publisher_1 = require("../events/publishers/categoryCreated.publisher");
const categoryUpdated_publisher_1 = require("../events/publishers/categoryUpdated.publisher");
const brandCreated_publisher_1 = require("../events/publishers/brandCreated.publisher");
const brandUpdated_publisher_1 = require("../events/publishers/brandUpdated.publisher");
class EventPublisherJob {
    constructor(natsClient, connection) {
        this.natsClient = natsClient;
        this.connection = connection;
        this.intervalId = null;
        this.monitoringId = null;
        this.outboxModel = (0, outbox_schema_1.createOutboxModel)(connection);
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            // Event publishing job
            this.intervalId = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                yield this.processEvents();
            }), EventPublisherJob.RETRY_INTERVAL);
            // Monitoring job
            this.monitoringId = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                yield this.monitorFailedEvents();
            }), EventPublisherJob.RETRY_INTERVAL);
        });
    }
    stop() {
        [this.intervalId, this.monitoringId].forEach(interval => {
            if (interval)
                clearInterval(interval);
        });
        this.intervalId = null;
        this.monitoringId = null;
    }
    processEvents() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Sadece bu environment'a ait pending eventleri al
                const currentEnvironment = process.env.NODE_ENV || 'production';
                const pendingEvents = yield this.outboxModel.find({
                    status: 'pending',
                    environment: currentEnvironment,
                    retryCount: { $lt: 5 }
                })
                    .sort({ createdAt: 1 })
                    .limit(10);
                if (pendingEvents.length > 0) {
                    logger_service_1.logger.debug(`Processing ${pendingEvents.length} events for environment: ${currentEnvironment}`);
                }
                for (const event of pendingEvents) {
                    try {
                        // Atomik güncelleme: pending durumundaki event'i processing olarak işaretle
                        // ve aynı zamanda versiyon kontrolü yap
                        const updated = yield this.outboxModel.updateOne({
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
                        yield this.publishEvent(event);
                        // Başarılı olarak işaretle
                        yield this.outboxModel.updateOne({ _id: event.id, status: 'processing' }, { $set: { status: 'published' } });
                        logger_service_1.logger.info(`Successfully published event ${event.id}`);
                    }
                    catch (error) {
                        yield this.outboxModel.updateOne({ _id: event.id, status: 'processing' }, {
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
                case common_1.Subjects.PlatformCategoryCreated:
                    yield new platformCategoryCreated_publisher_1.PlatformCategoryCreatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.PlatformCategoryUpdated:
                    yield new platformCategoryUpdated_publisher_1.PlatformCategoryUpdatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.PlatformBrandCreated:
                    yield new platformBrandCreated_publisher_1.PlatformBrandCreatedPublisher(this.natsClient)
                        .publish(event.payload);
                    break;
                case common_1.Subjects.PlatformBrandUpdated:
                    yield new platformBrandUpdated_publisher_1.PlatformBrandUpdatedPublisher(this.natsClient)
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
                default:
                    throw new Error(`Unknown event type: ${event.eventType}`);
            }
        });
    }
}
exports.EventPublisherJob = EventPublisherJob;
EventPublisherJob.RETRY_INTERVAL = 5000; // 5 saniye
EventPublisherJob.ALERT_THRESHOLD = 5; // 5 başarısız event alert eşiği
