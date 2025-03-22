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
const outbox_schema_1 = require("../models/outbox.schema");
const productCreated_publisher_1 = require("../events/publishers/productCreated.publisher");
const common_1 = require("@xmoonx/common");
const productUpdated_publisher_1 = require("../events/publishers/productUpdated.publisher");
const packageProductLinkCreated_publisher_1 = require("../events/publishers/packageProductLinkCreated.publisher");
const packageProductLinkUpdated_publisher_1 = require("../events/publishers/packageProductLinkUpdated.publisher");
const relationProductLinkCreated_publisher_1 = require("../events/publishers/relationProductLinkCreated.publisher");
const relationProductLinkUpdated_publisher_1 = require("../events/publishers/relationProductLinkUpdated.publisher");
const combinationCreated_publisher_1 = require("../events/publishers/combinationCreated.publisher");
const combinationUpdated_publisher_1 = require("../events/publishers/combinationUpdated.publisher");
class EventPublisherJob {
    constructor(natsClient) {
        this.natsClient = natsClient;
        this.intervalId = null;
        this.monitoringId = null;
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
                const pendingEvents = yield outbox_schema_1.Outbox.find({
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
                const failedEvents = yield outbox_schema_1.Outbox.countDocuments({
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
                default:
                    throw new Error(`Unknown event type: ${event.eventType}`);
            }
        });
    }
}
exports.EventPublisherJob = EventPublisherJob;
EventPublisherJob.RETRY_INTERVAL = 5000; // 5 saniye
EventPublisherJob.ALERT_THRESHOLD = 5; // 5 başarısız event alert eşiği
