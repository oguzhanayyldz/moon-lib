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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeadLetterProcessorJob = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const deadLetter_schema_1 = require("../models/deadLetter.schema");
const logger_service_1 = require("../services/logger.service");
class DeadLetterProcessorJob {
    constructor(natsClient, connection = mongoose_1.default.connection) {
        this.natsClient = natsClient;
        this.connection = connection;
        this.intervalId = null;
        this.stuckCheckIntervalId = null;
        this.deadLetterModel = (0, deadLetter_schema_1.createDeadLetterModel)(connection);
    }
    start() {
        if (this.intervalId) {
            return;
        }
        logger_service_1.logger.info('Dead letter processor job started');
        // İlk kez hemen çalıştır
        this.processPendingEvents().catch(error => {
            logger_service_1.logger.error('Dead letter processor error:', error);
        });
        // Düzenli aralıklarla çalıştır
        this.intervalId = setInterval(() => __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.processPendingEvents();
            }
            catch (error) {
                logger_service_1.logger.error('Dead letter processor error:', error);
            }
        }), DeadLetterProcessorJob.PROCESSOR_INTERVAL);
        // 5 dakikada bir takılı kalan işlemleri serbest bırakacak ek timer ekle
        this.stuckCheckIntervalId = setInterval(() => __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.releaseStuckEvents();
            }
            catch (error) {
                logger_service_1.logger.error('Error checking stuck events:', error);
            }
        }), 5 * 60 * 1000);
    }
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            logger_service_1.logger.info('Dead letter processor job stopped');
        }
        if (this.stuckCheckIntervalId) {
            clearInterval(this.stuckCheckIntervalId);
            this.stuckCheckIntervalId = null;
        }
    }
    /**
     * Bekleyen dead letter olaylarını işle
     */
    processPendingEvents() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // İşleme süresi (10 dakika)
                const processingTimeout = new Date(Date.now() - 10 * 60 * 1000);
                // İşleyiciyi tanımla
                const processorId = process.env.POD_NAME || Math.random().toString(36).substring(2, 15);
                // Bul ve güncelle - atomik işlem
                const event = yield this.deadLetterModel.findOneAndUpdate({
                    $or: [
                        // Pending durumundaki event'ler
                        {
                            status: 'pending',
                            nextRetryAt: { $lte: new Date() },
                            retryCount: { $lt: 5 }
                        },
                        // Takılı kalmış processing event'ler
                        {
                            status: 'processing',
                            processingStartedAt: { $lt: processingTimeout }
                        }
                    ]
                }, {
                    $set: {
                        status: 'processing',
                        processorId: processorId,
                        processingStartedAt: new Date()
                    }
                }, {
                    sort: { nextRetryAt: 1 },
                    new: true
                });
                if (!event) {
                    return;
                }
                // İşle ve yayınla
                yield this.processEvent(event);
                // Tekrar çağır (batch işleme yerine sırayla)
                yield this.processPendingEvents();
            }
            catch (error) {
                logger_service_1.logger.error('Error processing dead letter events:', error);
            }
        });
    }
    /**
     * Tek bir dead letter olayını işle
     */
    processEvent(event) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_service_1.logger.info(`Processing dead letter event ${event.id}: ${event.subject}`);
                // NATS'e geri yayınla
                yield this.publishToNats(event.subject, event.data);
                // Başarılı olarak işaretle
                yield this.deadLetterModel.updateOne({
                    _id: event.id,
                    status: 'processing',
                    processorId: event.processorId
                }, {
                    $set: {
                        status: 'completed',
                        completedAt: new Date()
                    }
                });
                logger_service_1.logger.info(`Successfully processed dead letter event ${event.id}`);
            }
            catch (error) {
                logger_service_1.logger.error(`Error processing dead letter event ${event.id}:`, error);
                // Takılı kalmaması için atomik güncelle
                const updated = yield this.deadLetterModel.findOneAndUpdate({
                    _id: event.id,
                    status: 'processing',
                    processorId: event.processorId
                }, {
                    $set: {
                        status: 'pending',
                        nextRetryAt: new Date(Date.now() + Math.pow(2, event.retryCount + 1) * 60000)
                    },
                    $inc: { retryCount: 1 },
                    $unset: { processorId: 1, processingStartedAt: 1 }
                }, { new: true });
                if (updated && updated.retryCount >= updated.maxRetries) {
                    yield this.deadLetterModel.updateOne({ _id: updated.id }, { $set: { status: 'failed' } });
                    logger_service_1.logger.error(`Dead letter event ${updated.id} permanently failed after ${updated.retryCount} attempts`);
                }
            }
        });
    }
    /**
     * NATS'e olay yayınla
     */
    publishToNats(subject, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this.natsClient.publish(subject, JSON.stringify(data), (err) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve();
                    }
                });
            });
        });
    }
    /**
     * Takılı kalan işlemleri serbest bırak
     */
    releaseStuckEvents() {
        return __awaiter(this, void 0, void 0, function* () {
            const stuckTimeout = new Date(Date.now() - 10 * 60 * 1000); // 10 dakika
            const result = yield this.deadLetterModel.updateMany({
                status: 'processing',
                processingStartedAt: { $lt: stuckTimeout }
            }, {
                $set: { status: 'pending' },
                $unset: { processorId: 1, processingStartedAt: 1 }
            });
            if (result.modifiedCount > 0) {
                logger_service_1.logger.info(`Released ${result.modifiedCount} stuck dead letter events`);
            }
        });
    }
}
exports.DeadLetterProcessorJob = DeadLetterProcessorJob;
DeadLetterProcessorJob.PROCESSOR_INTERVAL = 60000; // Her 1 dakikada bir çalış
