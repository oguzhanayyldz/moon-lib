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
exports.RetryableListener = void 0;
const crypto_1 = __importDefault(require("crypto"));
const common_1 = require("../common");
const retryManager_1 = require("../services/retryManager");
const redisEnvScope_util_1 = require("../utils/redisEnvScope.util");
const deadLetter_schema_1 = require("../models/deadLetter.schema");
const mongoose_1 = __importDefault(require("mongoose"));
const redisWrapper_service_1 = require("../services/redisWrapper.service");
const logger_service_1 = require("../services/logger.service");
const EventMetrics_1 = require("../metrics/EventMetrics");
const deadLetterReplayRegistry_1 = require("./deadLetterReplayRegistry");
/**
 * Retry özellikli temel listener sınıfı
 */
class RetryableListener extends common_1.Listener {
    constructor(client, options = {}, connection = mongoose_1.default.connection) {
        super(client);
        this.options = Object.assign(Object.assign({}, RetryableListener.DEFAULT_OPTIONS), options);
        // ackWait'i override et (base class'ta 5s, burada options'dan alıyoruz)
        this.ackWait = this.options.ackWaitSec * 1000;
        this.retryManager = new retryManager_1.RetryManager({ maxRetries: this.options.maxRetries });
        this.connection = connection;
    }
    /**
     * Aboneliği başlatır ve listener'ı süreç içi DLQ oynatma defterine kaydeder (issue #648 DLQ-H).
     * DeadLetterProcessorJob yalnız bu süreçte kayıtlı ve oynatması açık listener'ların DLQ kayıtlarını oynatır.
     */
    listen() {
        super.listen();
        deadLetterReplayRegistry_1.deadLetterReplayRegistry.register(this, this.options.deadLetterReplay);
    }
    /**
     * Distributed lock ile işlem yapmak için yardımcı metod
     */
    processWithLock(eventId, callback, payloadFingerprint) {
        return __awaiter(this, void 0, void 0, function* () {
            // Ortam kapsamlı kilit (ENV-ISO): ad yalnız çözülen ortam 'production' ise aynı kalır
            // (REDIS_KEY_ENV || NODE_ENV || 'production'). invoice ve shipment prod'da NODE_ENV=development
            // koşar; REDIS_KEY_ENV=production verilmezse orada da `development:` öneki alır.
            // Farklı ortamlar aynı eventId için birbirinin kilidini tutup mesajı düşürtemez.
            const lockKey = (0, redisEnvScope_util_1.envScopedKey)(`lock:${this.subject}:${eventId}`);
            const owner = process.env.POD_NAME || process.env.HOSTNAME || Math.random().toString();
            // Parmak izi kilit değerine yazılır: çatışan teslim, kilidi aynı içeriğin mi yoksa aynı eventId'yi
            // paylaşan başka bir olayın mı tuttuğunu buradan ayırt eder (TASK-MUD6C7R77TT38).
            const lockValue = payloadFingerprint ? `${owner}#${payloadFingerprint}` : owner;
            // Log ekleniyor
            logger_service_1.logger.debug(`Attempting to acquire lock for ${this.subject}:${eventId}`);
            // Lock'ı almaya çalış - NX ile sadece key yoksa oluşturur
            const lockAcquired = yield this.tryAcquireLock(lockKey, lockValue, this.options.lockTimeoutSec);
            if (!lockAcquired) {
                logger_service_1.logger.info(`Lock acquisition failed for ${this.subject}:${eventId}`);
                throw new Error(`Lock acquisition failed for ${this.subject}:${eventId}`);
            }
            logger_service_1.logger.debug(`Lock acquired for ${this.subject}:${eventId}`);
            try {
                const result = yield callback();
                logger_service_1.logger.debug(`Process completed with lock for ${this.subject}:${eventId}`);
                return result;
            }
            finally {
                // İşlem tamamlandığında kilidi serbest bırak
                yield this.releaseLock(lockKey, lockValue);
                logger_service_1.logger.debug(`Lock released for ${this.subject}:${eventId}`);
            }
        });
    }
    /**
     * Redis'te lock almaya çalışır
     */
    tryAcquireLock(key, value, expirySeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            // SET NX (only if not exists) with expiry
            const redis = redisWrapper_service_1.redisWrapper.client;
            const result = yield redis.set(key, value, {
                NX: true,
                EX: expirySeconds
            });
            return result === 'OK';
        });
    }
    /**
     * Redis'teki lock'ı kaldırır (sadece kendimizin oluşturduğu kilidi)
     */
    releaseLock(key, expectedValue) {
        return __awaiter(this, void 0, void 0, function* () {
            const redis = redisWrapper_service_1.redisWrapper.client;
            // Lua script to delete key only if it has the expected value
            const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end`;
            try {
                yield redis.eval(script, {
                    keys: [key],
                    arguments: [expectedValue]
                });
            }
            catch (error) {
                logger_service_1.logger.error(`Failed to release lock for key ${key}:`, error);
            }
        });
    }
    /**
     * Retry mantığı ile geliştirilmiş mesaj işleme
     */
    onMessage(data, msg) {
        return __awaiter(this, void 0, void 0, function* () {
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
                    const fingerprint = this.getPayloadFingerprint(data);
                    try {
                        yield this.processWithLock(eventId, () => __awaiter(this, void 0, void 0, function* () {
                            yield this.processEvent(data);
                            return;
                        }), fingerprint);
                        // Başarılı işlemede retry sayacını sıfırla
                        yield this.retryManager.resetRetryCount(eventType, eventId);
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
                            // Lock alınamadı — kısa jitter ile return, blocking sleep YAPMA
                            const lockKey = (0, redisEnvScope_util_1.envScopedKey)(`lock:${this.subject}:${eventId}`);
                            try {
                                const ttl = yield redisWrapper_service_1.redisWrapper.client.ttl(lockKey);
                                span.setTag('lock.conflict', true);
                                span.setTag('lock.ttl', ttl);
                                if (ttl === -2 || ttl === -1) {
                                    // Key yok veya expire olmuş - race condition, NATS redeliver etsin
                                    logger_service_1.logger.warn(`Lock key not found or expired (ttl: ${ttl}), NATS will redeliver: ${eventType}:${eventId}`);
                                    span.setTag('lock.orphan', true);
                                    // Kısa jitter (50-250ms) — thread'i bloklamadan
                                    yield new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 200));
                                    return; // msg.ack() YOK - NATS redeliver edecek
                                }
                                if (ttl > 0 && ttl <= 5) {
                                    // Lock yakında expire olacak — kısa bekle, ama uzun blocking yok
                                    const jitteredWait = Math.min(ttl * 1000, 3000) + Math.random() * 500;
                                    logger_service_1.logger.info(`Lock expiring soon (ttl: ${ttl}s), short wait ${Math.round(jitteredWait)}ms: ${eventType}:${eventId}`);
                                    span.setTag('lock.short_wait', Math.round(jitteredWait));
                                    yield new Promise(resolve => setTimeout(resolve, jitteredWait));
                                    return; // NATS redeliver edecek — re-lock denemesi yapmıyoruz (deadlock riski)
                                }
                                // TTL > 5s — kilit aktif olarak tutuluyor. eventId çoğu dinleyicide sürümsüz varlık kimliğidir
                                // (ör. `order-batch-${list[0].id}`); aynı varlığın art arda gelen iki farklı olayı aynı kilidi ister.
                                // Yalnız kilidi aynı içerik tutuyorsa bu teslim bir kopyadır ve ack'lenir; aksi halde ack'lemek
                                // farklı olayı hiç işlenmeden düşürür (TASK-MUD6C7R77TT38).
                                const holder = yield redisWrapper_service_1.redisWrapper.client.get(lockKey);
                                if (holder === null || holder === void 0 ? void 0 : holder.endsWith(`#${fingerprint}`)) {
                                    logger_service_1.logger.info(`Another instance actively processing the same payload (ttl: ${ttl}s): ${eventType}:${eventId}`);
                                    span.setTag('lock.active_processing', true);
                                    msg.ack();
                                    return;
                                }
                                logger_service_1.logger.warn(`Lock held by a different event with the same eventId (ttl: ${ttl}s), NATS will redeliver: ${eventType}:${eventId}`);
                                span.setTag('lock.different_payload', true);
                                return; // msg.ack() YOK - kilit bırakıldıktan sonra NATS yeniden teslim edecek
                            }
                            catch (ttlError) {
                                // TTL kontrolü başarısız — güvenli tarafta kal, NATS redeliver etsin
                                logger_service_1.logger.error(`Failed to check lock TTL: ${eventType}:${eventId}`, ttlError);
                                span.setTag('lock.ttl_error', true);
                                return; // msg.ack() YOK
                            }
                        }
                        // Diğer lock hataları için normal exception akışına devam et
                        throw lockError;
                    }
                }
                // Lock etkin değilse normal işleme devam et
                yield this.processEvent(data);
                // Başarılı işlemede retry sayacını sıfırla
                yield this.retryManager.resetRetryCount(eventType, eventId);
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
                const errorMessage = this.describeError(error);
                span.setTag('error', true);
                span.setTag('error.message', errorMessage);
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
                    const retryCount = yield this.retryManager.incrementRetryCount(eventType, eventId);
                    span.setTag('retry.count', retryCount);
                    // Hala denenmeli mi kontrol et
                    if (yield this.retryManager.shouldRetry(eventType, eventId)) {
                        logger_service_1.logger.info(`Redis retry ${retryCount}/${this.options.maxRetries} for ${eventType}:${eventId}`);
                        span.setTag('retry.scheduled', true);
                        // Record retry metrics
                        EventMetrics_1.EventMetrics.eventRetryTotal.inc({
                            service: serviceName,
                            event_type: eventType,
                            retry_reason: errorMessage.substring(0, 100), // Limit length
                            retry_count: retryCount.toString()
                        });
                        // msg.ack() çağırmadan çık. Bu, NATS'in mesajı yeniden göndermesini sağlar.
                    }
                    else {
                        logger_service_1.logger.info(`Max retries (${this.options.maxRetries}) reached for ${eventType}:${eventId}`);
                        if (this.options.enableDeadLetter) {
                            try {
                                yield this.moveToDeadLetterQueue(data, errorMessage, retryCount);
                                span.setTag('dead_letter.saved', true);
                                // Record DLQ metrics
                                EventMetrics_1.EventMetrics.eventDlqTotal.inc({
                                    service: serviceName,
                                    event_type: eventType,
                                    failure_reason: errorMessage.substring(0, 100) // Limit length
                                });
                            }
                            catch (dlqError) {
                                if ((dlqError === null || dlqError === void 0 ? void 0 : dlqError.name) === 'ValidationError') {
                                    // Kayıt her teslimde aynı veriden kurulur; şema doğrulaması yeniden teslimle düzelmez.
                                    // Ack'lenmezse mesaj her ackWait'te süresiz yeniden teslim edilir, bu yüzden hata loglanıp ack'lenir.
                                    logger_service_1.logger.error(`Dead letter record failed schema validation and can never be saved, acking without a DLQ record: ${eventType}:${eventId}`, dlqError);
                                    span.setTag('dead_letter.invalid', true);
                                    EventMetrics_1.EventMetrics.eventDlqWriteErrorTotal.inc({
                                        service: serviceName,
                                        event_type: eventType,
                                        reason: 'invalid'
                                    });
                                    msg.ack();
                                    return;
                                }
                                logger_service_1.logger.error('Failed to save to dead letter queue, NATS will redeliver:', dlqError);
                                span.setTag('dead_letter.error', dlqError.message);
                                EventMetrics_1.EventMetrics.eventDlqWriteErrorTotal.inc({
                                    service: serviceName,
                                    event_type: eventType,
                                    reason: 'unavailable'
                                });
                                // msg.ack() YOK - DLQ kaydı yokken ack'lemek mesajı kalıcı kaybeder (issue #648 K-3)
                                return;
                            }
                        }
                        msg.ack();
                    }
                }
            }
            finally {
                span.finish();
            }
        });
    }
    /**
     * Anlık tekrar denemelerle işlemi gerçekleştir
     */
    processWithImmediateRetries(data, msg, span) {
        return __awaiter(this, void 0, void 0, function* () {
            let lastError;
            for (let attempt = 1; attempt <= this.options.immediateRetries; attempt++) {
                try {
                    // Ana işlem metodu
                    yield this.processEvent(data);
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
                        yield new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            }
            // Tüm denemeler başarısız olduysa, son hatayı fırlat
            if (lastError) {
                throw lastError;
            }
        });
    }
    /**
     * DLQ kaydını bu süreçte, bu listener'ın işleme yoluyla bir kez daha işler (issue #648 DLQ-H).
     * NATS'e yayın yapmaz, mesaj ack'lemez ve yeni DLQ kaydı yazmaz; kaydı DeadLetterProcessorJob günceller.
     * - `processed`: işlendi. Duplicate key hatası da canlı yoldaki gibi işlenmiş sayılır.
     * - `busy`: işleme başlayamadı (olay kilitli ya da kilit alınamadı); deneme bütçesi tüketilmez. DeadLetterProcessorJob
     *   zaman sınırını aşan oynatmayı da, işleme başlamış olsa bile, `busy` sayar.
     * - `failed`: işleme hata verdi; bütçeden bir deneme düşülür.
     */
    replayDeadLetter(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const eventType = this.subject;
            const eventId = this.getEventId(data);
            let started = false;
            const run = () => __awaiter(this, void 0, void 0, function* () {
                started = true;
                yield this.processEvent(data);
            });
            try {
                if (this.options.enableLock) {
                    yield this.processWithLock(eventId, run, this.getPayloadFingerprint(data));
                }
                else {
                    yield run();
                }
            }
            catch (error) {
                if (!started) {
                    logger_service_1.logger.info(`Dead letter replay postponed, processing could not start: ${eventType}:${eventId}: ${this.describeError(error)}`);
                    return 'busy';
                }
                if (this.isDuplicateKeyError(error)) {
                    logger_service_1.logger.info(`Dead letter replay treated as processed - duplicate key: ${eventType}:${eventId}`);
                    return 'processed';
                }
                logger_service_1.logger.error(`Dead letter replay failed: ${eventType}:${eventId}:`, error);
                return 'failed';
            }
            try {
                yield this.retryManager.resetRetryCount(eventType, eventId);
            }
            catch (resetError) {
                // Olay işlendi; sayaç sıfırlanamazsa Redis TTL'i dolunca silinir
                logger_service_1.logger.warn(`Failed to reset retry count after dead letter replay: ${eventType}:${eventId}`, resetError);
            }
            logger_service_1.logger.info(`Dead letter replay processed: ${eventType}:${eventId}`);
            return 'processed';
        });
    }
    /**
     * İşlenemeyen olayı Dead Letter kuyruğuna taşı. Kayıt yazılamazsa hata fırlatır; çağıran mesajı ack'lemez
     * (kalıcı olan şema doğrulaması hatası hariç: o durumda hata loglanıp mesaj ack'lenir).
     *
     * Deneme bütçesi (issue #648 K-2): `retryCount` bu olayın toplam başarısız deneme sayısıdır (Redis sayacı),
     * `maxRetries` ise NATS denemeleri + DLQ oynatmaları toplamıdır. Bütçe dolmuşsa kayıt `failed` yazılır ve oynatılmaz.
     * Oynatılacak kayıt `queued` yazılır ve kaydı yazan listener'ın anahtarını taşır (issue #648 DLQ-H): başarısız bir
     * oynatma yeni kayıt yazmaz, DeadLetterProcessorJob aynı kaydın `retryCount`'unu artırır.
     */
    moveToDeadLetterQueue(data, errorMessage, retryCount) {
        return __awaiter(this, void 0, void 0, function* () {
            // Mikroservis özelinde bağlantı durumunu kontrol et
            if (this.connection.readyState !== 1) {
                throw new Error(`MongoDB bağlantısı hazır değil, DeadLetter kaydedilemedi - readyState: ${this.connection.readyState}`);
            }
            const deadLetterModel = (0, deadLetter_schema_1.createDeadLetterModel)(this.connection);
            const eventId = this.getEventId(data);
            const attemptBudget = this.options.maxRetries + this.options.deadLetterMaxRetries;
            const replayable = retryCount < attemptBudget;
            yield deadLetterModel.build({
                subject: this.subject,
                eventId: eventId,
                data: data,
                error: errorMessage,
                retryCount: retryCount,
                maxRetries: attemptBudget,
                status: replayable ? 'queued' : 'failed',
                listenerKey: (0, deadLetterReplayRegistry_1.buildListenerKey)(this.subject, this.queueGroupName),
                queueGroupName: this.queueGroupName,
                service: process.env.SERVICE_NAME || 'unknown',
                nextRetryAt: new Date(Date.now() + this.getDeadLetterReplayDelay(retryCount)),
                timestamp: new Date()
            }).save();
            if (replayable) {
                logger_service_1.logger.info(`Event moved to DLQ: ${this.subject}:${eventId} (attempt ${retryCount}/${attemptBudget})`);
            }
            else {
                logger_service_1.logger.error(`Event permanently failed, DLQ record will not be replayed: ${this.subject}:${eventId} (attempt ${retryCount}/${attemptBudget})`);
            }
        });
    }
    /**
     * DLQ oynatmaları arasındaki bekleme: 1, 2, 4, 8, 16 dk ... (üst sınır 30 dk).
     * `retryCount` olayın toplam başarısız deneme sayısıdır; ilk `maxRetries` deneme NATS teslimidir, gerisi oynatmadır.
     */
    getDeadLetterReplayDelay(retryCount) {
        const replaysSoFar = Math.max(retryCount - this.options.maxRetries, 0);
        return Math.min(60000 * Math.pow(2, replaysSoFar), 30 * 60000);
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
     * Olay içeriğinin parmak izi. Aynı eventId altında kopya teslimi farklı olaydan ayırmak için kilit değerine yazılır.
     */
    getPayloadFingerprint(data) {
        var _a;
        return crypto_1.default.createHash('sha1').update((_a = JSON.stringify(data)) !== null && _a !== void 0 ? _a : '').digest('hex');
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
     * Hata nesnesinden HTTP durum kodunu çıkarır. Kod bulunamazsa 0 döner.
     *
     * Aday sırası kasıtlıdır:
     * - `response.status`: axios ve fetch benzeri istemcilerde HTTP kodunun TEK güvenilir yeri.
     * - `statusCode`: moon `CustomError` ailesi (`BadRequestError` 400, `ConflictError` 409,
     *   `LockedError` 423, `RateLimit` 429, `DatabaseConnectionError` 500 …) ve Node http.
     * - `status`: axios'a yalnız 1.8'de eklendi; depodaki semver aralıkları `^1.6.0`'a kadar
     *   iniyor, bu yüzden tek başına güvenilmez — yedek adaydır.
     *
     * `error.code` KASITLI OLARAK okunmaz: axios'ta STRING bir tanımlayıcıdır
     * (`'ERR_BAD_REQUEST'`, `'ECONNREFUSED'`), MongoDB'de ise HTTP dışı bir sayıdır (11000).
     * Eskiden durum kodu adayıydı ve string değeri sayısal karşılaştırmalara sokuluyordu;
     * JS'te `'ERR_BAD_REQUEST' >= 200` daima `false` ürettiği için bu sessizce yanlış sonuç
     * veriyordu. Yalnız 100-599 aralığındaki tam sayılar HTTP kodu sayılır.
     */
    extractHttpStatusCode(error) {
        var _a;
        const candidates = [
            (_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.status,
            error === null || error === void 0 ? void 0 : error.statusCode,
            error === null || error === void 0 ? void 0 : error.status
        ];
        for (const candidate of candidates) {
            const value = typeof candidate === 'number'
                ? candidate
                : (typeof candidate === 'string' && /^\d+$/.test(candidate) ? Number(candidate) : NaN);
            if (Number.isInteger(value) && value >= 100 && value <= 599) {
                return value;
            }
        }
        return 0;
    }
    /**
 * Hatanın geçici mi kalıcı mı olduğunu belirler
 * Geçici hatalar için retry yapılmalı, kalıcı hatalar için yapılmamalı
 */
    isTransientError(error) {
        try {
            // Hata mesajı içeriği
            const errorMessage = ((error === null || error === void 0 ? void 0 : error.message) || '').toLowerCase();
            // 0. İptal edilmiş istek: çağıran vazgeçti, yeniden denemek yanlış.
            // Durum kodu taşımaz, bu yüzden aşağıdaki desen katmanından ÖNCE ele alınır;
            // aksi halde axios'un bazı iptal metinleri 'aborted' desenine takılıp geçici sayılır.
            if ((error === null || error === void 0 ? void 0 : error.code) === 'ERR_CANCELED' || (error === null || error === void 0 ? void 0 : error.name) === 'CanceledError') {
                return false;
            }
            // HTTP durum kodu (varsa)
            const statusCode = this.extractHttpStatusCode(error);
            // 1. Durum kodu BİLİNİYORSA karar yalnız ona göre verilir.
            //
            // HTTP sözleşmesi deterministiktir; hata metnine bakmak ancak kod yokken anlamlıdır.
            // Eski sırada desen eşleme bu kuraldan ÖNCE koşuyordu ve axios'un varsayılan metni
            // ("Request failed with status code 404") geçici desen listesindeki 'request failed'
            // ile eşleştiği için 4xx → kalıcı kuralı axios hataları için ÖLÜ KODdu: her 400/401/
            // 403/404/409/422 üç kez yeniden deneniyordu (gerçek axios ile ölçüldü, 6/14 yanlış).
            if (statusCode > 0) {
                // 5xx: sunucu tarafı, geçici
                if (statusCode >= 500) {
                    return true;
                }
                // 429 (hız sınırı) ve 408 (istek zaman aşımı): 4xx olsa da yeniden denenebilir
                if (statusCode === 429 || statusCode === 408) {
                    return true;
                }
                // Diğer tüm 4xx: kalıcı — istek düzeltilmeden sonuç değişmez
                if (statusCode >= 400) {
                    return false;
                }
                // 1xx/2xx/3xx: hata değil ya da yeniden denemenin sonucu değiştirmeyeceği durum
                return false;
            }
            // 2. Durum kodu YOK → karar hata metnine kalıyor (NATS, Mongo, iş kuralı, ham soket)
            // a) Bağlantı, timeout ve ağ hataları
            //
            // NOT: desenler `errorMessage` KÜÇÜK HARFE çevrildikten sonra aranır; listedeki
            // girdiler de bu yüzden küçük harf olmalıdır. 'ETIMEDOUT' ve 'ECONNABORTED' eskiden
            // büyük harfliydi ve hiçbir zaman eşleşmiyordu (ölü desen) — küçük harfe alındı.
            // 'request failed' ÇIKARILDI: durum kodu artık 1. adımda doğru okunuyor, kod taşıyan
            // hatalar buraya hiç inmiyor; desen yalnız kalıcı 4xx'leri geçici yapmaya yarıyordu.
            const transientErrorPatterns = [
                'connection', 'timeout', 'network', 'econnrefused', 'econnreset',
                'unavailable', 'temporarily', 'socket hang up', 'etimedout',
                'econnaborted', 'enotfound', 'failed to fetch',
                'service unavailable', 'internal server error', 'bad gateway',
                'gateway timeout', 'too many requests', 'request timeout',
                'operation timed out', 'aborted', 'quota exceeded', 'try again later',
                'try later', 'temporary failure', 'status 5', 'status code 5'
            ];
            if (transientErrorPatterns.some(pattern => errorMessage.includes(pattern))) {
                return true;
            }
            // 3. Kesin kalıcı hata durumları (retry yapılmamalı)
            // a) Doğrulama ve kimlik doğrulama hataları
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
     * Hatanın metnini döndürür. Mesajsız Error ya da Error olmayan bir throw için de boş olmayan metin üretir:
     * DeadLetter şemasında `error` zorunlu alandır ve boş metin kaydı geçersiz kılar.
     */
    describeError(error) {
        const message = error === null || error === void 0 ? void 0 : error.message;
        return (typeof message === 'string' && message) || String(error) || 'Unknown error';
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
    enableLock: true, // Varsayılan olarak lock etkin
    ackWaitSec: 60, // NATS ack timeout - lock TTL'inden büyük olmalı
    deadLetterReplay: true // false ise DLQ kayıtları oynatılmaz, kayıt olarak bekler
};
