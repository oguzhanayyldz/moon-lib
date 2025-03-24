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
                    .limit(10); // Batch processing
                for (const event of pendingEvents) {
                    try {
                        yield this.publishEvent(event);
                        event.status = 'published';
                        yield event.save();
                        console.log(`Successfully published event ${event.id}`);
                    }
                    catch (error) {
                        event.status = 'failed';
                        event.retryCount += 1;
                        event.lastAttempt = new Date();
                        yield event.save();
                        console.error(`Failed to publish event ${event.id}:`, error);
                    }
                }
            }
            catch (error) {
                console.error('Event processing failed:', error);
            }
        });
    }
    monitorFailedEvents() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const failedEvents = yield this.outboxModel.countDocuments({
                    status: 'failed',
                    retryCount: { $gte: 5 }
                });
                if (failedEvents >= EventPublisherJob.ALERT_THRESHOLD) {
                    console.error(`ALERT: ${failedEvents} events have failed permanently!`);
                    // Burada alert sisteminize bağlanabilirsiniz (Slack, Email, vs.)
                }
            }
            catch (error) {
                console.error('Monitoring failed:', error);
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
                default:
                    throw new Error(`Unknown event type: ${event.eventType}`);
            }
        });
    }
}
exports.EventPublisherJob = EventPublisherJob;
EventPublisherJob.RETRY_INTERVAL = 5000; // 5 saniye
EventPublisherJob.ALERT_THRESHOLD = 5; // 5 başarısız event alert eşiği
