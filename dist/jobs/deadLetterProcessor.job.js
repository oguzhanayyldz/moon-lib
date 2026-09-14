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
const EventMetrics_1 = require("../metrics/EventMetrics");
const deadLetterReplayRegistry_1 = require("../events/deadLetterReplayRegistry");
class DeadLetterProcessorJob {
    /**
     * @param natsClient Servislerdeki mevcut çağrıyla uyum için imzada kalır. Hedefli oynatma (issue #648 DLQ-H)
     * NATS'e yayın yapmaz: kaydı, kaydı yazan listener bu süreçte işler.
     */
    constructor(natsClient, connection = mongoose_1.default.connection) {
        this.connection = connection;
        this.intervalId = null;
        this.stuckCheckIntervalId = null;
        this.running = false;
        this.deadLetterModel = (0, deadLetter_schema_1.createDeadLetterModel)(connection);
    }
    /**
     * DLQ oynatmasının kapatma anahtarı. Varsayılan KAPALI: DEAD_LETTER_REPLAY_ENABLED 'true' değilse
     * hiçbir kayıt claim edilmez, kayıtlar bekler ve silinmez.
     */
    static isReplayEnabled() {
        return process.env.DEAD_LETTER_REPLAY_ENABLED === 'true';
    }
    start() {
        if (this.intervalId) {
            return;
        }
        logger_service_1.logger.info(`Dead letter processor job started (replay ${DeadLetterProcessorJob.isReplayEnabled() ? 'enabled' : 'disabled'})`);
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
     * Zamanı gelmiş DLQ kayıtlarını, kaydı yazan listener'a bu süreçte oynat (issue #648 DLQ-H).
     * - Yalnız bu süreçte kayıtlı ve oynatması açık listener'ların kayıtları claim edilir. Başka kuyruk grubunun
     *   kaydı, oynatması kapalı listener'ın kaydı ve listenerKey'i olmayan eski kayıt seçilmez.
     * - Bir tur sürerken yeni tur başlamaz; bir turda en fazla MAX_REPLAYS_PER_CYCLE kayıt işlenir.
     */
    processPendingEvents() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.running || !DeadLetterProcessorJob.isReplayEnabled()) {
                return;
            }
            const listenerKeys = deadLetterReplayRegistry_1.deadLetterReplayRegistry.replayableKeys();
            if (listenerKeys.length === 0) {
                return;
            }
            this.running = true;
            try {
                // İşleyiciyi tanımla
                const processorId = process.env.POD_NAME || Math.random().toString(36).substring(2, 15);
                for (let replayed = 0; replayed < DeadLetterProcessorJob.MAX_REPLAYS_PER_CYCLE; replayed++) {
                    const event = yield this.claimNextEvent(listenerKeys, processorId);
                    if (!event) {
                        return;
                    }
                    yield this.processEvent(event);
                }
            }
            catch (error) {
                // MongoDB "not primary" hatalarını ayır - silent fail
                const mongoError = error;
                if ((mongoError === null || mongoError === void 0 ? void 0 : mongoError.code) === 10107 || (mongoError === null || mongoError === void 0 ? void 0 : mongoError.codeName) === 'NotWritablePrimary') {
                    logger_service_1.logger.warn('MongoDB not writable (secondary node detected), skipping this cycle');
                    return; // Bir sonraki cycle'da primary'e bağlanırsa dener
                }
                logger_service_1.logger.error('Error processing dead letter events:', error);
            }
            finally {
                this.running = false;
            }
        });
    }
    /**
     * Sıradaki kaydı atomik olarak claim et
     */
    claimNextEvent(listenerKeys, processorId) {
        return __awaiter(this, void 0, void 0, function* () {
            const processingTimeout = new Date(Date.now() - DeadLetterProcessorJob.PROCESSING_TIMEOUT);
            // Sadece bu environment'a ait eventleri al
            const currentEnvironment = process.env.NODE_ENV || 'production';
            return yield this.deadLetterModel.findOneAndUpdate({
                environment: currentEnvironment,
                listenerKey: { $in: listenerKeys },
                $or: [
                    // Oynatılmayı bekleyen ve deneme bütçesi dolmamış kayıtlar (issue #648 K-2).
                    // RetryableListener retryCount'a toplam deneme sayısını, maxRetries'a toplam bütçeyi yazar.
                    {
                        status: 'queued',
                        nextRetryAt: { $lte: new Date() },
                        $expr: { $lt: ['$retryCount', '$maxRetries'] }
                    },
                    // Takılı kalmış oynatmalar
                    {
                        status: 'replaying',
                        processingStartedAt: { $lt: processingTimeout }
                    }
                ]
            }, {
                $set: {
                    status: 'replaying',
                    processorId: processorId,
                    processingStartedAt: new Date()
                }
            }, {
                sort: { nextRetryAt: 1 },
                new: true
            });
        });
    }
    /**
     * Tek bir dead letter olayını kaydı yazan listener'a oynat ve sonucu aynı kayda yaz
     */
    processEvent(event) {
        return __awaiter(this, void 0, void 0, function* () {
            const target = event.listenerKey ? deadLetterReplayRegistry_1.deadLetterReplayRegistry.get(event.listenerKey) : undefined;
            if (!target) {
                // Claim yalnız kayıtlı anahtarları seçer; defter bu arada değiştiyse kayıt bütçe tüketmeden geri bırakılır
                logger_service_1.logger.warn(`No replay target registered for dead letter event ${event.id}: ${event.listenerKey}`);
                yield this.requeue(event, DeadLetterProcessorJob.BUSY_RETRY_DELAY);
                return;
            }
            logger_service_1.logger.info(`Replaying dead letter event ${event.id}: ${event.listenerKey}`);
            let result;
            try {
                result = yield target.replayDeadLetter(event.data);
            }
            catch (error) {
                // replayDeadLetter hatayı kendisi sonuca çevirir; beklenmeyen bir hata başarısız deneme sayılır
                logger_service_1.logger.error(`Error replaying dead letter event ${event.id}:`, error);
                result = 'failed';
            }
            EventMetrics_1.EventMetrics.eventDlqReplayTotal.inc({
                service: event.service,
                event_type: event.subject,
                queue_group: event.queueGroupName || 'unknown',
                result
            });
            if (result === 'processed') {
                yield this.deadLetterModel.updateOne(this.claimedBy(event), {
                    $set: {
                        status: 'completed',
                        completedAt: new Date()
                    }
                });
                logger_service_1.logger.info(`Successfully replayed dead letter event ${event.id}`);
                return;
            }
            if (result === 'busy') {
                // Olay başka bir teslimde işleniyor: deneme bütçesi tüketilmez
                yield this.requeue(event, DeadLetterProcessorJob.BUSY_RETRY_DELAY);
                return;
            }
            yield this.markReplayFailed(event, target);
        });
    }
    /**
     * Başarısız oynatma aynı kaydın sayacını artırır; bütçe dolunca kayıt `failed` olur ve bir daha oynatılmaz
     */
    markReplayFailed(event, target) {
        return __awaiter(this, void 0, void 0, function* () {
            const retryCount = event.retryCount + 1;
            const exhausted = retryCount >= event.maxRetries;
            const delay = Math.min(target.getDeadLetterReplayDelay(retryCount), DeadLetterProcessorJob.MAX_RETRY_DELAY);
            yield this.deadLetterModel.updateOne(this.claimedBy(event), {
                $set: {
                    status: exhausted ? 'failed' : 'queued',
                    nextRetryAt: new Date(Date.now() + delay)
                },
                $inc: { retryCount: 1 },
                $unset: { processorId: 1, processingStartedAt: 1 }
            });
            if (exhausted) {
                logger_service_1.logger.error(`Dead letter event ${event.id} permanently failed after ${retryCount} attempts: ${event.listenerKey}`);
            }
        });
    }
    /**
     * Kaydı sayacını artırmadan yeniden kuyruğa al
     */
    requeue(event, delay) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.deadLetterModel.updateOne(this.claimedBy(event), {
                $set: {
                    status: 'queued',
                    nextRetryAt: new Date(Date.now() + delay)
                },
                $unset: { processorId: 1, processingStartedAt: 1 }
            });
        });
    }
    /**
     * Kayıt hâlâ bu işleyicide mi: takılı sayılıp başka işleyiciye geçen kayda dokunulmaz
     */
    claimedBy(event) {
        return {
            _id: event.id,
            status: 'replaying',
            processorId: event.processorId
        };
    }
    /**
     * Takılı kalan işlemleri serbest bırak ve bu süreçte oynatıcısı olmayan bekleyen kayıtları logla
     */
    releaseStuckEvents() {
        return __awaiter(this, void 0, void 0, function* () {
            const stuckTimeout = new Date(Date.now() - DeadLetterProcessorJob.PROCESSING_TIMEOUT);
            const currentEnvironment = process.env.NODE_ENV || 'production';
            const result = yield this.deadLetterModel.updateMany({
                environment: currentEnvironment,
                status: 'replaying',
                processingStartedAt: { $lt: stuckTimeout }
            }, {
                $set: { status: 'queued' },
                $unset: { processorId: 1, processingStartedAt: 1 }
            });
            // DLQ-H öncesi işlemcinin takılı bıraktığı kayıtlar eskisi gibi pending'e döner; bu işlemci pending seçmez
            const legacyResult = yield this.deadLetterModel.updateMany({
                environment: currentEnvironment,
                status: 'processing',
                processingStartedAt: { $lt: stuckTimeout }
            }, {
                $set: { status: 'pending' },
                $unset: { processorId: 1, processingStartedAt: 1 }
            });
            const released = result.modifiedCount + legacyResult.modifiedCount;
            if (released > 0) {
                logger_service_1.logger.info(`Released ${released} stuck dead letter events`);
            }
            // Kaydı yazan listener bu süreçte başlatılmadıysa (kaldırıldı ya da kuyruk grubu değişti) kayıt hiç oynatılmaz
            const unmatched = yield this.deadLetterModel.countDocuments({
                environment: currentEnvironment,
                status: 'queued',
                listenerKey: { $nin: deadLetterReplayRegistry_1.deadLetterReplayRegistry.registeredKeys() }
            });
            if (unmatched > 0) {
                logger_service_1.logger.warn(`${unmatched} queued dead letter events have no listener registered in this process and will not be replayed`);
            }
        });
    }
}
exports.DeadLetterProcessorJob = DeadLetterProcessorJob;
DeadLetterProcessorJob.PROCESSOR_INTERVAL = 60000; // Her 1 dakikada bir çalış
DeadLetterProcessorJob.MAX_RETRY_DELAY = 30 * 60000; // Başarısız oynatmadan sonra en fazla 30 dakika bekle
DeadLetterProcessorJob.BUSY_RETRY_DELAY = 60000; // Olay kilitliyse 1 dakika sonra yeniden dene
DeadLetterProcessorJob.MAX_REPLAYS_PER_CYCLE = 50; // Bir turda en fazla bu kadar kayıt oynatılır
DeadLetterProcessorJob.PROCESSING_TIMEOUT = 10 * 60 * 1000; // Bu süreden uzun süren oynatma takılı sayılır
