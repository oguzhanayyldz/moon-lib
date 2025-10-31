"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryableListener = void 0;
const common_1 = require("../common");
const retryManager_1 = require("../services/retryManager");
const deadLetter_schema_1 = require("../models/deadLetter.schema");
const mongoose_1 = __importDefault(require("mongoose"));
const redisWrapper_service_1 = require("../services/redisWrapper.service");
const logger_service_1 = require("../services/logger.service");
const EventMetrics_1 = require("../metrics/EventMetrics");
/**
 * Retry özellikli temel listener sınıfı
 */
class RetryableListener extends common_1.Listener {
    constructor(client, options = {}, connection = mongoose_1.default.connection) {
        super(client);
        this.options = Object.assign(Object.assign({}, RetryableListener.DEFAULT_OPTIONS), options);
        this.retryManager = new retryManager_1.RetryManager();
        this.connection = connection;
    }
    /**
     * Distributed lock ile işlem yapmak için yardımcı metod
     */
    async processWithLock(eventId, callback) {
        const lockKey = `lock:${this.subject}:${eventId}`;
        const lockValue = process.env.POD_NAME || process.env.HOSTNAME || Math.random().toString();
        // Log ekleniyor
        logger_service_1.logger.debug(`Attempting to acquire lock for ${this.subject}:${eventId}`);
        // Lock'ı almaya çalış - NX ile sadece key yoksa oluşturur
        const lockAcquired = await this.tryAcquireLock(lockKey, lockValue, this.options.lockTimeoutSec);
        if (!lockAcquired) {
            logger_service_1.logger.info(`Lock acquisition failed for ${this.subject}:${eventId}`);
            throw new Error(`Lock acquisition failed for ${this.subject}:${eventId}`);
        }
        logger_service_1.logger.debug(`Lock acquired for ${this.subject}:${eventId}`);
        try {
            const result = await callback();
            logger_service_1.logger.debug(`Process completed with lock for ${this.subject}:${eventId}`);
            return result;
        }
        finally {
            // İşlem tamamlandığında kilidi serbest bırak
            await this.releaseLock(lockKey, lockValue);
            logger_service_1.logger.debug(`Lock released for ${this.subject}:${eventId}`);
        }
    }
    /**
     * Redis'te lock almaya çalışır
     */
    async tryAcquireLock(key, value, expirySeconds) {
        // SET NX (only if not exists) with expiry
        const redis = redisWrapper_service_1.redisWrapper.client;
        const result = await redis.set(key, value, {
            NX: true,
            EX: expirySeconds
        });
        return result === 'OK';
    }
    /**
     * Redis'teki lock'ı kaldırır (sadece kendimizin oluşturduğu kilidi)
     */
    async releaseLock(key, expectedValue) {
        const redis = redisWrapper_service_1.redisWrapper.client;
        // Lua script to delete key only if it has the expected value
        const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end`;
        try {
            await redis.eval(script, {
                keys: [key],
                arguments: [expectedValue]
            });
        }
        catch (error) {
            logger_service_1.logger.error(`Failed to release lock for key ${key}:`, error);
        }
    }
    /**
     * Retry mantığı ile geliştirilmiş mesaj işleme
     */
    async onMessage(data, msg) {
        var _a;
        const eventId = this.getEventId(data);
        const eventType = this.subject;
        const span = this.createTraceSpan(eventType, eventId);
        // Start timer for metrics
        const startTime = Date.now();
        const serviceName = process.env.SERVICE_NAME || 'unknown';
        try {
            // Distributed lock ile işlemi gerçekleştir (etkinse)
            if (this.options.enableLock) {
                try {
                    await this.processWithLock(eventId, async () => {
                        await this.processEvent(data);
                        return;
                    });
                    // Başarılı işlemede retry sayacını sıfırla
                    await this.retryManager.resetRetryCount(eventType, eventId);
                    span.setTag('success', true);
                    span.setTag('lock.success', true);
                    // Record success metrics
                    const duration = (Date.now() - startTime) / 1000;
                    EventMetrics_1.EventMetrics.eventProcessingDuration.observe({
                        service: serviceName,
                        event_type: eventType,
                        queue_group: this.queueGroupName,
                        status: 'success'
                    }, duration);
                    EventMetrics_1.EventMetrics.eventProcessingTotal.inc({
                        service: serviceName,
                        event_type: eventType,
                        queue_group: this.queueGroupName,
                        status: 'success'
                    });
                    msg.ack();
                    return;
                }
                catch (lockError) {
                    if ((_a = lockError.message) === null || _a === void 0 ? void 0 : _a.includes('Lock acquisition failed')) {
                        // Başka bir instance işlemi zaten yapıyor - log ve ack
                        logger_service_1.logger.info(`Event ${eventType}:${eventId} is being processed by another instance`);
                        span.setTag('lock.conflict', true);
                        msg.ack(); // Mesajı onaylayalım, başka instance işliyor zaten
                        return;
                    }
                    // Diğer lock hataları için normal exception akışına devam et
                    throw lockError;
                }
            }
            // Lock etkin değilse normal işleme devam et
            await this.processEvent(data);
            // Başarılı işlemede retry sayacını sıfırla
            await this.retryManager.resetRetryCount(eventType, eventId);
            span.setTag('success', true);
            // Record success metrics
            const duration = (Date.now() - startTime) / 1000;
            EventMetrics_1.EventMetrics.eventProcessingDuration.observe({
                service: serviceName,
                event_type: eventType,
                queue_group: this.queueGroupName,
                status: 'success'
            }, duration);
            EventMetrics_1.EventMetrics.eventProcessingTotal.inc({
                service: serviceName,
                event_type: eventType,
                queue_group: this.queueGroupName,
                status: 'success'
            });
            msg.ack();
        }
        catch (error) {
            // Mevcut hata işleme kodu...
            span.setTag('error', true);
            span.setTag('error.message', error.message);
            logger_service_1.logger.error(`Error processing ${eventType}:${eventId}:`, error);
            // Record error metrics
            const duration = (Date.now() - startTime) / 1000;
            EventMetrics_1.EventMetrics.eventProcessingDuration.observe({
                service: serviceName,
                event_type: eventType,
                queue_group: this.queueGroupName,
                status: 'error'
            }, duration);
            EventMetrics_1.EventMetrics.eventProcessingTotal.inc({
                service: serviceName,
                event_type: eventType,
                queue_group: this.queueGroupName,
                status: 'error'
            });
            // MongoDB duplicate key hatası kontrolü
            const isDuplicateKeyError = this.isDuplicateKeyError(error);
            if (isDuplicateKeyError) {
                // Unique constraint hatası - retry yapmayacağız
                logger_service_1.logger.info(`Retry atlanıyor - Duplicate key hatası: ${eventType}:${eventId}`);
                span.setTag('error.retry_skipped', true);
                span.setTag('error.duplicate_key', true);
                // Mesajı onaylayıp geçiyoruz
                msg.ack();
            }
            else {
                // Diğer hatalar için normal retry işlemi - mevcut kodunuzdaki gibi
                const retryCount = await this.retryManager.incrementRetryCount(eventType, eventId);
                span.setTag('retry.count', retryCount);
                // Hala denenmeli mi kontrol et
                if (await this.retryManager.shouldRetry(eventType, eventId)) {
                    logger_service_1.logger.info(`Redis retry ${retryCount}/${this.options.maxRetries} for ${eventType}:${eventId}`);
                    span.setTag('retry.scheduled', true);
                    // Record retry metrics
                    EventMetrics_1.EventMetrics.eventRetryTotal.inc({
                        service: serviceName,
                        event_type: eventType,
                        retry_reason: error.message.substring(0, 100), // Limit length
                        retry_count: retryCount.toString()
                    });
                    // msg.ack() çağırmadan çık. Bu, NATS'in mesajı yeniden göndermesini sağlar.
                }
                else {
                    logger_service_1.logger.info(`Max retries (${this.options.maxRetries}) reached for ${eventType}:${eventId}`);
                    if (this.options.enableDeadLetter) {
                        try {
                            await this.moveToDeadLetterQueue(data, error, retryCount);
                            span.setTag('dead_letter.saved', true);
                            // Record DLQ metrics
                            EventMetrics_1.EventMetrics.eventDlqTotal.inc({
                                service: serviceName,
                                event_type: eventType,
                                failure_reason: error.message.substring(0, 100) // Limit length
                            });
                        }
                        catch (dlqError) {
                            logger_service_1.logger.error('Failed to save to dead letter queue:', dlqError);
                            span.setTag('dead_letter.error', dlqError.message);
                        }
                    }
                    msg.ack();
                }
            }
        }
        finally {
            span.finish();
        }
    }
    /**
     * Anlık tekrar denemelerle işlemi gerçekleştir
     */
    async processWithImmediateRetries(data, msg, span) {
        let lastError;
        for (let attempt = 1; attempt <= this.options.immediateRetries; attempt++) {
            try {
                // Ana işlem metodu
                await this.processEvent(data);
                span.setTag('immediate_retry.success', true);
                span.setTag('immediate_retry.attempt', attempt);
                return; // Başarılı olduğunda hemen dön
            }
            catch (error) {
                lastError = error;
                span.setTag('immediate_retry.attempt', attempt);
                // Kalıcı bir hata ise hemen yeniden denemeyi bırak
                if (!this.isTransientError(error)) {
                    span.setTag('immediate_retry.permanent_error', true);
                    break;
                }
                // Son deneme değilse kısa bir süre bekle ve tekrar dene
                if (attempt < this.options.immediateRetries) {
                    const delay = Math.pow(2, attempt - 1) * 100; // 100ms, 200ms, 400ms, ...
                    span.setTag('immediate_retry.delay_ms', delay);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        // Tüm denemeler başarısız olduysa, son hatayı fırlat
        if (lastError) {
            throw lastError;
        }
    }
    /**
     * İşlenemeyen olayı Dead Letter kuyruğuna taşı
     */
    async moveToDeadLetterQueue(data, error, retryCount) {
        // Mikroservis özelinde bağlantı durumunu kontrol et
        if (this.connection.readyState !== 1) {
            logger_service_1.logger.error(`MongoDB bağlantısı hazır değil, DeadLetter kaydedilemedi - readyState: ${this.connection.readyState}`);
            return;
        }
        const deadLetterModel = (0, deadLetter_schema_1.createDeadLetterModel)(this.connection);
        const eventId = this.getEventId(data);
        await deadLetterModel.build({
            subject: this.subject,
            eventId: eventId,
            data: data,
            error: error.message,
            retryCount: retryCount,
            maxRetries: this.options.deadLetterMaxRetries,
            service: process.env.SERVICE_NAME || 'unknown',
            nextRetryAt: new Date(Date.now() + 60000), // 1 dakika sonra yeniden dene
            timestamp: new Date()
        }).save();
        logger_service_1.logger.info(`Event moved to DLQ: ${this.subject}:${eventId}`);
    }
    /**
     * Olaydan benzersiz bir ID çıkar
     * Alt sınıflar tarafından override edilebilir
     */
    getEventId(data) {
        var _a;
        // Yaygın ID formatları
        if (data.id)
            return data.id;
        if (data.list && ((_a = data.list[0]) === null || _a === void 0 ? void 0 : _a.id))
            return data.list[0].id;
        // Özel ID oluştur (hash benzeri)
        return `${this.subject}-${JSON.stringify(data).slice(0, 50).replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}`;
    }
    /**
     * İzleme için span oluştur
     */
    createTraceSpan(eventType, eventId) {
        try {
            const { tracer } = require('../../services/tracer');
            const span = tracer.startSpan(`${eventType}-listener`);
            span.setTag('event.type', eventType);
            span.setTag('event.id', eventId);
            return span;
        }
        catch (error) {
            // Mock span döndür
            return {
                setTag: () => { },
                finish: () => { }
            };
        }
    }
    /**
 * Hatanın geçici mi kalıcı mı olduğunu belirler
 * Geçici hatalar için retry yapılmalı, kalıcı hatalar için yapılmamalı
 */
    isTransientError(error) {
        try {
            // Hata mesajı içeriği
            const errorMessage = ((error === null || error === void 0 ? void 0 : error.message) || '').toLowerCase();
            // HTTP durum kodu (varsa)
            const statusCode = (error === null || error === void 0 ? void 0 : error.statusCode) || (error === null || error === void 0 ? void 0 : error.status) || (error === null || error === void 0 ? void 0 : error.code) || 0;
            // 1. İstisnai durum kontrolü: İşlemin başarılı olduğu durumlar
            if (statusCode >= 200 && statusCode < 300) {
                return false; // Başarılı durum kodları için retry yapma
            }
            // 2. Kesin geçici hata durumları (retry yapılmalı)
            // a) HTTP 5xx hatalarını geçici olarak değerlendir
            if (statusCode >= 500 && statusCode < 600) {
                return true;
            }
            // b) HTTP 429 (Too Many Requests) - Rate limit
            if (statusCode === 429) {
                return true;
            }
            // c) Bağlantı, timeout ve ağ hataları
            const transientErrorPatterns = [
                'connection', 'timeout', 'network', 'econnrefused', 'econnreset',
                'unavailable', 'temporarily', 'socket hang up', 'ETIMEDOUT',
                'ECONNABORTED', 'ENOTFOUND', 'request failed', 'failed to fetch',
                'service unavailable', 'internal server error', 'bad gateway',
                'gateway timeout', 'too many requests', 'request timeout',
                'operation timed out', 'aborted', 'quota exceeded', 'try again later',
                'try later', 'temporary failure', 'status 5', 'status code 5'
            ];
            if (transientErrorPatterns.some(pattern => errorMessage.includes(pattern))) {
                return true;
            }
            // 3. Kesin kalıcı hata durumları (retry yapılmamalı)
            // a) HTTP 4xx hatalarından 429 dışında olanlar kalıcı hatadır
            if (statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
                return false;
            }
            // b) Doğrulama ve kimlik doğrulama hataları
            const permanentErrorPatterns = [
                'validation', 'invalid', 'bad request', 'not found', 'forbidden',
                'unauthorized', 'permission', 'access denied', 'auth failed',
                'authentication failed', 'expired token', 'invalid token',
                'missing parameter', 'parameter missing', 'malformed', 'syntax error',
                'payload too large', 'unprocessable entity', 'unsupported', 'not allowed'
            ];
            if (permanentErrorPatterns.some(pattern => errorMessage.includes(pattern))) {
                return false;
            }
            // 4. Bilinen Error sınıfları için özel kontroller
            // MongoDB bağlantı ve ağ hataları
            if (error.name === 'MongoNetworkError' || error.name === 'MongoTimeoutError') {
                return true;
            }
            // Duplicate key hataları kalıcıdır
            if (error.name === 'MongoError' && (error.code === 11000 || errorMessage.includes('duplicate'))) {
                return false;
            }
            // Axios/Fetch network hataları
            if (error.name === 'AxiosError' && error.code === 'ECONNABORTED') {
                return true;
            }
            // 5. Redis hatalarını değerlendir
            const redisKeywords = ['redis', 'cache'];
            if (redisKeywords.some(pattern => errorMessage.includes(pattern))) {
                // Redis bağlantı hataları geçicidir
                if (errorMessage.includes('connection') || errorMessage.includes('timeout')) {
                    return true;
                }
            }
            // 6. Beklenmedik hataları değerlendir
            // JavaScript hatalarının çoğu uygulama kodundaki sorunlardır ve genelde kalıcıdır
            const jsErrors = [
                'TypeError', 'ReferenceError', 'SyntaxError', 'RangeError',
                'EvalError', 'URIError'
            ];
            if (jsErrors.includes(error.name)) {
                return false; // Kod hatalarını retry yaparak çözemeyiz
            }
            // Stack trace'de node_modules içerenler genelde uygulama hatalarıdır
            if (error.stack && error.stack.includes('node_modules') &&
                !error.stack.includes('node-fetch') &&
                !error.stack.includes('axios') &&
                !error.stack.includes('request')) {
                return false;
            }
            // 7. Son çare: belirsiz hata
            // Bilinmeyen veya tanımlanamayan hataları ne yapacağız?
            // İki strateji olabilir:
            // A) Varsayılan olarak geçici kabul et (daha agresif retry)
            // return true; 
            // B) Varsayılan olarak kalıcı kabul et (daha konservatif retry)
            return false;
        }
        catch (analyzeError) {
            // Hata analizi sırasında bir hata olursa - en güvenli: retry yapma
            console.error('Error while analyzing error type:', analyzeError);
            return false;
        }
    }
    /**
     * MongoDB duplicate key hatası olup olmadığını kontrol eder
     */
    isDuplicateKeyError(error) {
        // MongoDB duplicate key hata mesajı kontrolü
        if (error instanceof Error) {
            // MongoDB hata kodu 11000 duplicate key hatası
            if (error.name === 'MongoError' && error.code === 11000) {
                return true;
            }
            // Hata mesajında duplicate key ifadesi var mı?
            if (error.message.includes('duplicate key') ||
                error.message.includes('E11000') ||
                error.message.includes('duplicate') ||
                error.message.includes('uniqueCode')) {
                return true;
            }
        }
        return false;
    }
}
exports.RetryableListener = RetryableListener;
// Varsayılan seçenekler - Lock eklendi
RetryableListener.DEFAULT_OPTIONS = {
    immediateRetries: 3, // Anında tekrar deneme sayısı
    enableDeadLetter: true, // Ölü mektup kuyruğunu etkinleştir
    maxRetries: 5, // Redis'te izlenen toplam deneme sayısı
    deadLetterMaxRetries: 5, // Ölü mektup kuyruğu için maksimum deneme
    lockTimeoutSec: 30, // Lock için varsayılan timeout süresi (saniye)
    enableLock: true // Varsayılan olarak lock etkin
};
//# sourceMappingURL=retryableListener.js.map