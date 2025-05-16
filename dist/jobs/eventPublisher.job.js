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
const common_1 = require("@xmoonx/common");
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
const productStockIntegrationUpdated_publisher_1 = require("../events/publishers/productStockIntegrationUpdated.publisher");
const productImageIntegrationUpdated_publisher_1 = require("../events/publishers/productImageIntegrationUpdated.publisher");
const catalogMappingCreated_publisher_1 = require("../events/publishers/catalogMappingCreated.publisher");
const logger_service_1 = require("../services/logger.service");
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
                const pendingEvents = yield this.outboxModel.find({
                    status: 'pending',
                    retryCount: { $lt: 5 }
                })
                    .sort({ createdAt: 1 })
                    .limit(10);
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
                default:
                    throw new Error(`Unknown event type: ${event.eventType}`);
            }
        });
    }
}
exports.EventPublisherJob = EventPublisherJob;
EventPublisherJob.RETRY_INTERVAL = 5000; // 5 saniye
EventPublisherJob.ALERT_THRESHOLD = 5; // 5 başarısız event alert eşiği
