import crypto from 'crypto';
import { Message, Stan } from 'node-nats-streaming';
import { Event, Listener } from '../common';
import { RetryManager } from '../services/retryManager';
import { envScopedKey } from '../utils/redisEnvScope.util';
import { createDeadLetterModel } from '../models/deadLetter.schema';
import mongoose from 'mongoose';
import { redisWrapper } from '../services/redisWrapper.service';
import { logger } from '../services/logger.service';
import { EventMetrics } from '../metrics/EventMetrics';
import { isDuplicateKeyError } from '../utils/duplicateKeyError.util';
import { isDeterministicEventError } from '../utils/eventErrorClassification.util';
import { startLockHeartbeat } from '../utils/lockHeartbeat.util';
import { buildListenerKey, deadLetterReplayRegistry, DeadLetterReplayResult } from './deadLetterReplayRegistry';

// Mevcut RetryOptions'a yeni özellikler ekle
interface RetryOptions {
    immediateRetries?: number;
    enableDeadLetter?: boolean;
    maxRetries?: number;
    deadLetterMaxRetries?: number;
    lockTimeoutSec?: number;      // Distributed lock için timeout süresi
    enableLock?: boolean;         // Distributed lock'u etkinleştirme
    ackWaitSec?: number;          // NATS ack timeout süresi (saniye)
    deadLetterReplay?: boolean;   // DLQ kayıtları bu listener'a oynatılsın mı (issue #648 DLQ-H)
    /**
     * E11000'den sonra processEvent'in süreç içinde kaç kez yeniden koşulacağı (UC-1020). 0 = eski davranış: ilk E11000'de ack.
     * E11000, çakışan yazımın kaydı ZATEN yazdığını söyler: yarışta (iki olay aynı benzersiz kaydı findOne→save ile oluşturuyor)
     * yeniden koşum o kaydı bulur ve başarılı olur; gerçek çiftte E11000 tekrarlanır ve mesaj eskisi gibi ack'lenir.
     * Verilmezse RETRYABLE_DUPLICATE_KEY_RETRIES ortam değişkeni (0–5), o da yoksa 0.
     */
    duplicateKeyRetries?: number;
    /**
     * Olay kilidinin işlem sürdükçe kaç ms'de bir yenileneceği (UC-1020). 0 = yenileme yok (eski davranış).
     * lockTimeoutSec'ten kısa olmalı; uzun işlerde kilidin işin ortasında düşüp yeniden teslimin işi kopyalamasını önler.
     * Verilmezse RETRYABLE_LOCK_RENEW_INTERVAL_MS, o da yoksa lockTimeoutSec/3 (UC-430/UC-821: ackWait'i aşan iş,
     * kilit düştüğü için yeniden teslimde ikinci kez koşuyordu).
     */
    lockRenewIntervalMs?: number;
    /**
     * Kilit yenilemesinin üst sınırı, ms (UC-1183). Aşılınca moon-lib heartbeat'i durur (logger.warn + retryable_listener_stuck_total
     * {reason="max_lock_hold"}); alt sınıf kendi heartbeat'ini sarmıyorsa kilit TTL'inde düşer, sonraki yeniden teslim işi devralır.
     * 0 = sınır yok (varsayılan). Verilmezse RETRYABLE_MAX_LOCK_HOLD_MS, o da yoksa 0.
     */
    maxLockHoldMs?: number;
    /**
     * Kilit sahibi hâlâ işlerken aynı mesajın kaç yeniden teslimden sonra takılı sayılacağı (UC-1183): warn + metrik
     * ({reason="redelivery"}, mesaj (eventId + sıra) başına bir kez). 0 = kapalı. Verilmezse RETRYABLE_STUCK_REDELIVERY_THRESHOLD, o da yoksa 5.
     */
    stuckRedeliveryThreshold?: number;
    /**
     * Kalıcı hatada (isPermanentError) NATS yeniden denemesini atla: ilk denemede 'failed' DLQ kaydı + ack (UC-1043).
     * false = eski davranış: maxRetries kez yeniden teslim, sonra 'queued' DLQ; kalıcı hata yalnız
     * event_permanent_error_total{outcome="shadow"} olarak sayılır (gölge mod).
     * Verilmezse RETRYABLE_PERMANENT_FAIL_FAST ('true' ya da '1'), o da yoksa false.
     */
    failFastOnPermanentError?: boolean;
}

const MAX_DUPLICATE_KEY_RETRIES = 5;

/**
 * RETRYABLE_DUPLICATE_KEY_RETRIES'ı okur; geçersiz ya da yoksa 0, üst sınır MAX_DUPLICATE_KEY_RETRIES.
 */
export function resolveDuplicateKeyRetries(explicit?: number): number {
    const raw = explicit ?? Number(process.env.RETRYABLE_DUPLICATE_KEY_RETRIES ?? 0);
    if (!Number.isInteger(raw) || raw < 0) return 0;
    return Math.min(raw, MAX_DUPLICATE_KEY_RETRIES);
}

/**
 * RETRYABLE_PERMANENT_FAIL_FAST'ı okur: yalnız 'true' ya da '1' açar; başka her değer kapalı.
 */
export function resolveFailFastOnPermanentError(explicit?: boolean): boolean {
    if (typeof explicit === 'boolean') return explicit;
    const raw = (process.env.RETRYABLE_PERMANENT_FAIL_FAST ?? '').trim().toLowerCase();
    return raw === 'true' || raw === '1';
}

/**
 * Kilit yenileme aralığını çözer (UC-430/UC-821): açık değer, yoksa RETRYABLE_LOCK_RENEW_INTERVAL_MS, o da yoksa
 * lockTimeoutSec/3. 0 = yenileme yok (açık değerle ya da ortam değişkeniyle kapatılır). Geçersiz değer varsayılana düşer.
 */
export function resolveLockRenewIntervalMs(explicit: number | undefined, lockTimeoutSec: number): number {
    const fallback = Math.max(1, Math.floor((lockTimeoutSec * 1000) / 3));
    const env = (process.env.RETRYABLE_LOCK_RENEW_INTERVAL_MS ?? '').trim();
    const raw = explicit ?? (env === '' ? undefined : Number(env));
    if (raw === undefined || !Number.isInteger(raw) || raw < 0) return fallback;
    return raw;
}

// Varsayılan kapalı: parasut sendToErp ve büyük katalog senkronları meşru olarak >15 dk sürebilir; sınır dinleyici bazında açılır.
const DEFAULT_MAX_LOCK_HOLD_MS = 0;
const DEFAULT_STUCK_REDELIVERY_THRESHOLD = 5;
const STUCK_REDELIVERY_KEY_PREFIX = 'event:same-message-redelivery:';
const STUCK_REDELIVERY_TTL_SEC = 3600;

/** Negatif olmayan tam sayı seçeneği çözer: açık değer, ortam değişkeni, varsayılan; geçersiz değer varsayılana düşer. */
function resolveNonNegativeInt(explicit: number | undefined, envName: string, fallback: number): number {
    const env = (process.env[envName] ?? '').trim();
    const raw = explicit ?? (env === '' ? undefined : Number(env));
    if (raw === undefined || !Number.isInteger(raw) || raw < 0) return fallback;
    return raw;
}

/** maxLockHoldMs'i çözer (UC-1183): açık değer, RETRYABLE_MAX_LOCK_HOLD_MS, 0 (sınır yok). */
export function resolveMaxLockHoldMs(explicit?: number): number {
    return resolveNonNegativeInt(explicit, 'RETRYABLE_MAX_LOCK_HOLD_MS', DEFAULT_MAX_LOCK_HOLD_MS);
}

/** stuckRedeliveryThreshold'u çözer (UC-1183): açık değer, RETRYABLE_STUCK_REDELIVERY_THRESHOLD, 5. 0 = kapalı. */
export function resolveStuckRedeliveryThreshold(explicit?: number): number {
    return resolveNonNegativeInt(explicit, 'RETRYABLE_STUCK_REDELIVERY_THRESHOLD', DEFAULT_STUCK_REDELIVERY_THRESHOLD);
}

/** Gölge modda kalıcı sayılan olayın işareti: sonraki teslimde başarı = yanlış pozitif (UC-1043). */
const PERMANENT_SHADOW_KEY_PREFIX = 'event:permanent-shadow:';
const PERMANENT_SHADOW_TTL_SEC = 86400;

/**
 * Retry özellikli temel listener sınıfı
 */
export abstract class RetryableListener<T extends Event> extends Listener<T> {
    private retryManager: RetryManager;
    private options: Required<RetryOptions>;
    private connection: mongoose.Connection;

    // Varsayılan seçenekler - Lock eklendi
    private static readonly DEFAULT_OPTIONS: Required<RetryOptions> = {
        immediateRetries: 3,      // Anında tekrar deneme sayısı
        enableDeadLetter: true,   // Ölü mektup kuyruğunu etkinleştir
        maxRetries: 5,            // Redis'te izlenen toplam deneme sayısı
        deadLetterMaxRetries: 5,  // Ölü mektup kuyruğu için maksimum deneme
        lockTimeoutSec: 30,       // Lock için varsayılan timeout süresi (saniye)
        enableLock: true,         // Varsayılan olarak lock etkin
        ackWaitSec: 60,           // NATS ack timeout - lock TTL'inden büyük olmalı
        deadLetterReplay: true,   // false ise DLQ kayıtları oynatılmaz, kayıt olarak bekler
        duplicateKeyRetries: 0,   // constructor'da ortam değişkeniyle çözülür
        lockRenewIntervalMs: 0,   // constructor'da lockTimeoutSec'ten çözülür
        maxLockHoldMs: 0,         // constructor'da ortam değişkeniyle çözülür
        stuckRedeliveryThreshold: 0, // constructor'da ortam değişkeniyle çözülür
        failFastOnPermanentError: false // constructor'da ortam değişkeniyle çözülür
    };

    constructor (client: Stan, options: RetryOptions = {}, connection: mongoose.Connection = mongoose.connection) {
        super(client);
        this.options = {
            ...RetryableListener.DEFAULT_OPTIONS,
            ...options,
            duplicateKeyRetries: resolveDuplicateKeyRetries(options.duplicateKeyRetries),
            maxLockHoldMs: resolveMaxLockHoldMs(options.maxLockHoldMs),
            stuckRedeliveryThreshold: resolveStuckRedeliveryThreshold(options.stuckRedeliveryThreshold),
            failFastOnPermanentError: resolveFailFastOnPermanentError(options.failFastOnPermanentError)
        };
        this.options.lockRenewIntervalMs = resolveLockRenewIntervalMs(options.lockRenewIntervalMs, this.options.lockTimeoutSec);
        if (this.options.enableLock && this.options.lockTimeoutSec >= this.options.ackWaitSec) {
            // Kilit ackWait'ten uzun tutulabilir (sync/shipment bilinçli: yeniden teslim 'aynı içerik işleniyor' diye tanınır).
            // Yenileme açıkken canlı sahibin kilidi zaten düşmez; bedel yalnız çöken sahipte: kilit ilk yeniden teslimden sonra düşer.
            logger.info(`lockTimeoutSec (${this.options.lockTimeoutSec}s) is not shorter than ackWaitSec (${this.options.ackWaitSec}s) in ${this.constructor.name}; if the owner crashes, takeover waits for the lock to expire (one or more extra redeliveries)`);
        }
        if (this.options.lockRenewIntervalMs > 0 && this.options.lockRenewIntervalMs >= this.options.lockTimeoutSec * 1000) {
            logger.warn(`lockRenewIntervalMs (${this.options.lockRenewIntervalMs}) is not shorter than lockTimeoutSec (${this.options.lockTimeoutSec}s); the lock can expire before it is renewed`);
        }
        // ackWait'i override et (base class'ta 5s, burada options'dan alıyoruz)
        this.ackWait = this.options.ackWaitSec * 1000;
        this.retryManager = new RetryManager({ maxRetries: this.options.maxRetries });
        this.connection = connection;
    }

    /**
     * Aboneliği başlatır ve listener'ı süreç içi DLQ oynatma defterine kaydeder (issue #648 DLQ-H).
     * DeadLetterProcessorJob yalnız bu süreçte kayıtlı ve oynatması açık listener'ların DLQ kayıtlarını oynatır.
     */
    listen() {
        super.listen();
        deadLetterReplayRegistry.register(this, this.options.deadLetterReplay);
    }

    /**
     * Distributed lock ile işlem yapmak için yardımcı metod
     */
    protected async processWithLock<R>(
        eventId: string,
        callback: () => Promise<R>,
        payloadFingerprint?: string,
        deliverySequence?: number
    ): Promise<R> {
        // Ortam kapsamlı kilit (ENV-ISO): ad yalnız çözülen ortam 'production' ise aynı kalır
        // (REDIS_KEY_ENV || NODE_ENV || 'production'). invoice ve shipment prod'da NODE_ENV=development
        // koşar; REDIS_KEY_ENV=production verilmezse orada da `development:` öneki alır.
        // Farklı ortamlar aynı eventId için birbirinin kilidini tutup mesajı düşürtemez.
        const lockKey = envScopedKey(`lock:${this.subject}:${eventId}`);
        const owner = process.env.POD_NAME || process.env.HOSTNAME || Math.random().toString();
        // Parmak izi kilit değerine yazılır: çatışan teslim, kilidi aynı içeriğin mi yoksa aynı eventId'yi
        // paylaşan başka bir olayın mı tuttuğunu buradan ayırt eder (TASK-MUD6C7R77TT38).
        // NATS sıra numarası da yazılır: çatışan teslim, kilit sahibinin işlediği mesajın yeniden teslimi mi yoksa
        // aynı içerikli ayrı bir mesaj mı, buradan ayırt eder (TASK-MUTVW04QWWV01).
        const lockValue = `${owner}${RetryableListener.lockValueSuffix(payloadFingerprint, deliverySequence)}`;

        // Log ekleniyor
        logger.debug(`Attempting to acquire lock for ${this.subject}:${eventId}`);

        // Lock'ı almaya çalış - NX ile sadece key yoksa oluşturur
        const lockAcquired = await this.tryAcquireLock(lockKey, lockValue, this.options.lockTimeoutSec);

        if (!lockAcquired) {
            logger.info(`Lock acquisition failed for ${this.subject}:${eventId}`);
            throw new Error(`Lock acquisition failed for ${this.subject}:${eventId}`);
        }

        logger.debug(`Lock acquired for ${this.subject}:${eventId}`);

        // Kendi kilit değerimizi bildiğimiz için yenileme tam eşleşmeyle yapılır (sonek yedeği gerekmez)
        const stopHeartbeat = this.options.lockRenewIntervalMs > 0
            ? startLockHeartbeat(lockKey, lockValue, '', this.options.lockTimeoutSec, this.options.lockRenewIntervalMs,
                this.options.maxLockHoldMs, () => this.recordStuck('max_lock_hold'))
            : undefined;

        try {
            const result = await callback();
            logger.debug(`Process completed with lock for ${this.subject}:${eventId}`);
            return result;
        } finally {
            stopHeartbeat?.();
            // İşlem tamamlandığında kilidi serbest bırak
            await this.releaseLock(lockKey, lockValue);
            logger.debug(`Lock released for ${this.subject}:${eventId}`);
        }
    }

    private recordStuck(reason: 'max_lock_hold' | 'redelivery'): void {
        EventMetrics.retryableListenerStuckTotal.inc({ listener: this.constructor.name, reason });
    }

    /**
     * Kilit sahibi hâlâ işlerken gelen aynı-mesaj yeniden teslimlerini sayar (UC-1183). Eşikte (mesaj başına bir kez) metrik,
     * eşikten itibaren her teslimde warn. Sayaç hatası teslim akışını bozmaz.
     */
    private async noteSameMessageRedelivery(eventType: string, eventId: string, sequence: number): Promise<void> {
        const threshold = this.options.stuckRedeliveryThreshold;
        if (threshold <= 0) return;
        try {
            // Sıra anahtarda: aynı eventId'li farklı mesajların yeniden teslimleri toplanmaz. INCR+EXPIRE tek MULTI'de (TTL'siz anahtar kalmaz).
            const key = envScopedKey(`${STUCK_REDELIVERY_KEY_PREFIX}${eventType}:${eventId}:${sequence}`);
            const [count] = await redisWrapper.client.multi().incr(key).expire(key, STUCK_REDELIVERY_TTL_SEC).exec() as [number, unknown];
            if (count < threshold) return;
            if (count === threshold) this.recordStuck('redelivery');
            logger.warn(`Event looks stuck: lock holder still processing after ${count} redeliveries of the same message in ${this.constructor.name}: ${eventType}:${eventId}`);
        } catch (err) {
            logger.warn(`Failed to count same-message redelivery: ${eventType}:${eventId}`, err);
        }
    }

    /**
     * Kilit değerinin sahip adından sonraki kısmı: `@<sıra>#<parmak izi>`, sıra yoksa `#<parmak izi>`, parmak izi yoksa boş.
     * Kilidi uzatan alt sınıflar (heartbeat) beklenen değeri bununla kurar.
     */
    protected static lockValueSuffix(payloadFingerprint?: string, deliverySequence?: number): string {
        if (!payloadFingerprint) return '';
        return deliverySequence !== undefined ? `@${deliverySequence}#${payloadFingerprint}` : `#${payloadFingerprint}`;
    }

    /**
     * Mesajın NATS sıra numarası; yeniden teslimde değişmez. Alınamazsa undefined.
     */
    private getDeliverySequence(msg: Message): number | undefined {
        try {
            const seq = typeof msg?.getSequence === 'function' ? msg.getSequence() : undefined;
            return typeof seq === 'number' && Number.isFinite(seq) ? seq : undefined;
        } catch {
            return undefined;
        }
    }

    /**
     * Redis'te lock almaya çalışır
     */
    private async tryAcquireLock(key: string, value: string, expirySeconds: number): Promise<boolean> {
        // SET NX (only if not exists) with expiry
        const redis = redisWrapper.client;
        const result = await redis.set(key, value, {
            NX: true,
            EX: expirySeconds
        });

        return result === 'OK';
    }

    /**
     * Redis'teki lock'ı kaldırır (sadece kendimizin oluşturduğu kilidi)
     */
    private async releaseLock(key: string, expectedValue: string): Promise<void> {
        const redis = redisWrapper.client;

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
        } catch (error) {
            logger.error(`Failed to release lock for key ${key}:`, error);
        }
    }

    /**
     * Retry mantığı ile geliştirilmiş mesaj işleme
     */
    async onMessage(data: T['data'], msg: Message): Promise<void> {
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
                const sequence = this.getDeliverySequence(msg);
                try {
                    await this.processWithLock(eventId, async () => {
                        await this.processEventWithDuplicateKeyRetries(data, eventId);
                        return;
                    }, fingerprint, sequence);

                    // Başarılı işlemede retry sayacını sıfırla
                    await this.retryManager.resetRetryCount(eventType, eventId);
                    await this.recordPermanentShadowRecovery(eventId, msg);
                    span.setTag('success', true);
                    span.setTag('lock.success', true);

                    // Record success metrics
                    const duration = (Date.now() - startTime) / 1000;
                    EventMetrics.eventProcessingDuration.observe({
                        service: serviceName,
                        event_type: eventType,
                        queue_group: this.queueGroupName,
                        status: 'success'
                    }, duration);
                    EventMetrics.eventProcessingTotal.inc({
                        service: serviceName,
                        event_type: eventType,
                        queue_group: this.queueGroupName,
                        status: 'success'
                    });

                    msg.ack();
                    return;
                } catch (lockError: any) {
                    if (lockError.message?.includes('Lock acquisition failed')) {
                        // Lock alınamadı — kısa jitter ile return, blocking sleep YAPMA
                        const lockKey = envScopedKey(`lock:${this.subject}:${eventId}`);

                        try {
                            const ttl = await redisWrapper.client.ttl(lockKey);
                            span.setTag('lock.conflict', true);
                            span.setTag('lock.ttl', ttl);

                            if (ttl === -2 || ttl === -1) {
                                // Key yok veya expire olmuş - race condition, NATS redeliver etsin
                                logger.warn(`Lock key not found or expired (ttl: ${ttl}), NATS will redeliver: ${eventType}:${eventId}`);
                                span.setTag('lock.orphan', true);
                                // Kısa jitter (50-250ms) — thread'i bloklamadan
                                await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 200));
                                return; // msg.ack() YOK - NATS redeliver edecek
                            }

                            if (ttl > 0 && ttl <= 5) {
                                // Lock yakında expire olacak — kısa bekle, ama uzun blocking yok
                                const jitteredWait = Math.min(ttl * 1000, 3000) + Math.random() * 500;
                                logger.info(`Lock expiring soon (ttl: ${ttl}s), short wait ${Math.round(jitteredWait)}ms: ${eventType}:${eventId}`);
                                span.setTag('lock.short_wait', Math.round(jitteredWait));
                                await new Promise(resolve => setTimeout(resolve, jitteredWait));
                                return; // NATS redeliver edecek — re-lock denemesi yapmıyoruz (deadlock riski)
                            }

                            // TTL > 5s — kilit aktif olarak tutuluyor. eventId çoğu dinleyicide sürümsüz varlık kimliğidir
                            // (ör. `order-batch-${list[0].id}`); aynı varlığın art arda gelen iki farklı olayı aynı kilidi ister.
                            // Yalnız kilidi aynı içerik tutuyorsa bu teslim bir kopyadır ve ack'lenir; aksi halde ack'lemek
                            // farklı olayı hiç işlenmeden düşürür (TASK-MUD6C7R77TT38).
                            const holder = await redisWrapper.client.get(lockKey);
                            // Kilit sahibi BU mesajı işliyorsa (aynı sıra numarası: ackWait aşıldı ya da sahip pod düştü ve
                            // NATS mesajı yeniden dağıttı) ack'lemek sahibin mesajını onaylar; sahip sonra çökerse mesaj bir
                            // daha gelmez. Ack'siz dönülür: sahip canlıysa kilidi tutar ve bitince kendisi ack'ler; sahip
                            // öldüyse kilit TTL'inde düşer, sonraki yeniden teslim işi devralır (TASK-MUTVW04QWWV01).
                            if (sequence !== undefined && holder?.endsWith(RetryableListener.lockValueSuffix(fingerprint, sequence))) {
                                logger.info(`Lock holder is processing this same message (seq: ${sequence}, ttl: ${ttl}s), NATS will redeliver: ${eventType}:${eventId}`);
                                span.setTag('lock.same_message', true);
                                await this.noteSameMessageRedelivery(eventType, eventId, sequence);
                                return; // msg.ack() YOK - sahip bitirince ack'ler; sahip düşerse yeniden teslim devralır
                            }
                            // Sıra numarası yoksa yeniden teslim, kilit sahibinin işlediği mesajın kendisi olabilir: ack'lenirse
                            // sahip sonra hata verdiğinde mesaj bir daha gelmez (UC-821 F-02).
                            if (sequence === undefined && msg.isRedelivered?.()) {
                                logger.info(`Redelivered message without sequence while the same payload is locked (ttl: ${ttl}s), NATS will redeliver: ${eventType}:${eventId}`);
                                span.setTag('lock.same_payload_redelivered', true);
                                return; // msg.ack() YOK
                            }
                            if (holder?.endsWith(`#${fingerprint}`)) {
                                logger.info(`Another instance actively processing the same payload (ttl: ${ttl}s): ${eventType}:${eventId}`);
                                span.setTag('lock.active_processing', true);
                                msg.ack();
                                return;
                            }

                            logger.warn(`Lock held by a different event with the same eventId (ttl: ${ttl}s), NATS will redeliver: ${eventType}:${eventId}`);
                            span.setTag('lock.different_payload', true);
                            return; // msg.ack() YOK - kilit bırakıldıktan sonra NATS yeniden teslim edecek

                        } catch (ttlError) {
                            // TTL kontrolü başarısız — güvenli tarafta kal, NATS redeliver etsin
                            logger.error(`Failed to check lock TTL: ${eventType}:${eventId}`, ttlError);
                            span.setTag('lock.ttl_error', true);
                            return; // msg.ack() YOK
                        }
                    }
                    // Diğer lock hataları için normal exception akışına devam et
                    throw lockError;
                }
            }

            // Lock etkin değilse normal işleme devam et
            await this.processEventWithDuplicateKeyRetries(data, eventId);

            // Başarılı işlemede retry sayacını sıfırla
            await this.retryManager.resetRetryCount(eventType, eventId);
            await this.recordPermanentShadowRecovery(eventId, msg);
            span.setTag('success', true);

            // Record success metrics
            const duration = (Date.now() - startTime) / 1000;
            EventMetrics.eventProcessingDuration.observe({
                service: serviceName,
                event_type: eventType,
                queue_group: this.queueGroupName,
                status: 'success'
            }, duration);
            EventMetrics.eventProcessingTotal.inc({
                service: serviceName,
                event_type: eventType,
                queue_group: this.queueGroupName,
                status: 'success'
            });

            msg.ack();
        } catch (error) {
            // Mevcut hata işleme kodu...
            const errorMessage = this.describeError(error);
            span.setTag('error', true);
            span.setTag('error.message', errorMessage);
            logger.error(`Error processing ${eventType}:${eventId}:`, error);

            // Record error metrics
            const duration = (Date.now() - startTime) / 1000;
            EventMetrics.eventProcessingDuration.observe({
                service: serviceName,
                event_type: eventType,
                queue_group: this.queueGroupName,
                status: 'error'
            }, duration);
            EventMetrics.eventProcessingTotal.inc({
                service: serviceName,
                event_type: eventType,
                queue_group: this.queueGroupName,
                status: 'error'
            });

            // MongoDB duplicate key hatası kontrolü
            const isDuplicate = isDuplicateKeyError(error);

            if (isDuplicate) {
                // Unique constraint hatası - NATS yeniden denemesi yapmayacağız. duplicateKeyRetries > 0 ise süreç içi
                // yeniden koşumlar da E11000 verdi: kayıt gerçekten mevcut (gerçek çift), ack doğru.
                logger.info(`Retry atlanıyor - Duplicate key hatası: ${eventType}:${eventId} (süreç içi yeniden koşum: ${this.options.duplicateKeyRetries})`);
                span.setTag('error.retry_skipped', true);
                span.setTag('error.duplicate_key', true);
                EventMetrics.eventDuplicateKeyTotal.inc({
                    service: serviceName,
                    event_type: eventType,
                    queue_group: this.queueGroupName,
                    outcome: 'acked'
                });

                // Mesajı onaylayıp geçiyoruz
                msg.ack();
            } else {
                const permanent = this.isPermanentError(error);
                if (permanent) {
                    span.setTag('error.permanent', true);
                }

                // Diğer hatalar için normal retry işlemi - mevcut kodunuzdaki gibi
                const retryCount = await this.retryManager.incrementRetryCount(eventType, eventId);
                span.setTag('retry.count', retryCount);

                if (permanent && this.options.failFastOnPermanentError) {
                    // UC-1043: aynı veriyle yeniden teslim sonucu değiştirmez; bütçeyi harcamadan oynatılmayan kayıt + ack
                    logger.error(`Permanent error, skipping redelivery: ${eventType}:${eventId} (${(error as Error)?.name})`);
                    span.setTag('error.retry_skipped', true);
                    EventMetrics.eventPermanentErrorTotal.inc({
                        service: serviceName,
                        event_type: eventType,
                        queue_group: this.queueGroupName,
                        outcome: 'failed_fast'
                    });
                    await this.deadLetterAndAck(data, msg, span, errorMessage, retryCount, true);
                    return;
                }
                if (permanent) {
                    await this.markPermanentShadow(eventId);
                }

                // Hala denenmeli mi kontrol et
                if (await this.retryManager.shouldRetry(eventType, eventId)) {
                    logger.info(`Redis retry ${retryCount}/${this.options.maxRetries} for ${eventType}:${eventId}`);
                    span.setTag('retry.scheduled', true);

                    // Record retry metrics
                    EventMetrics.eventRetryTotal.inc({
                        service: serviceName,
                        event_type: eventType,
                        retry_reason: errorMessage.substring(0, 100), // Limit length
                        retry_count: retryCount.toString()
                    });

                    // msg.ack() çağırmadan çık. Bu, NATS'in mesajı yeniden göndermesini sağlar.
                } else {
                    logger.info(`Max retries (${this.options.maxRetries}) reached for ${eventType}:${eventId}`);
                    await this.deadLetterAndAck(data, msg, span, errorMessage, retryCount, false);
                }
            }
        } finally {
            span.finish();
        }
    }

    /**
     * DLQ kaydını yazar (enableDeadLetter açıksa) ve mesajı ack'ler. `permanent` ise kayıt oynatılmayan 'failed' yazılır.
     * Kayıt yazılamazsa ack'lenmez, NATS yeniden teslim eder; kalıcı olan şema doğrulaması hatası loglanıp ack'lenir.
     */
    private async deadLetterAndAck(data: T['data'], msg: Message, span: any, errorMessage: string, retryCount: number, permanent: boolean): Promise<void> {
        const eventType = this.subject;
        const eventId = this.getEventId(data);
        const serviceName = process.env.SERVICE_NAME || 'unknown';

        if (this.options.enableDeadLetter) {
            try {
                await this.moveToDeadLetterQueue(data, errorMessage, retryCount, permanent);
                span.setTag('dead_letter.saved', true);

                // Record DLQ metrics
                EventMetrics.eventDlqTotal.inc({
                    service: serviceName,
                    event_type: eventType,
                    failure_reason: errorMessage.substring(0, 100) // Limit length
                });
            } catch (dlqError) {
                if ((dlqError as Error)?.name === 'ValidationError') {
                    // Kayıt her teslimde aynı veriden kurulur; şema doğrulaması yeniden teslimle düzelmez.
                    // Ack'lenmezse mesaj her ackWait'te süresiz yeniden teslim edilir, bu yüzden hata loglanıp ack'lenir.
                    logger.error(`Dead letter record failed schema validation and can never be saved, acking without a DLQ record: ${eventType}:${eventId}`, dlqError);
                    span.setTag('dead_letter.invalid', true);
                    EventMetrics.eventDlqWriteErrorTotal.inc({
                        service: serviceName,
                        event_type: eventType,
                        reason: 'invalid'
                    });
                    msg.ack();
                    return;
                }
                logger.error('Failed to save to dead letter queue, NATS will redeliver:', dlqError);
                span.setTag('dead_letter.error', (dlqError as Error).message);
                EventMetrics.eventDlqWriteErrorTotal.inc({
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

    /**
     * Hata aynı veriyle yeniden denemede de değişmez mi (UC-1043)? Servis düzeyi sınıflamayla aynı ad listesi
     * (isDeterministicEventError; shipment UC-1023, orders UC-1013, invoice UC-1025). Alt sınıf genişletebilir.
     * isTransientError KULLANILMAZ: bilinmeyen hatayı ve 'not found' metnini kalıcı sayar; oysa sıra dışı gelen
     * olaylar (ör. güncelleme, oluşturmadan önce) "bulunamadı" fırlatır ve yeniden teslimle düzelir.
     */
    protected isPermanentError(error: unknown): boolean {
        return isDeterministicEventError(error);
    }

    /** Gölge mod: kalıcı sayılan olayı sayar ve işaretler; sonraki teslimde başarı yanlış pozitif sayılır. Redis hatası yutulur. */
    private async markPermanentShadow(eventId: string): Promise<void> {
        try {
            EventMetrics.eventPermanentErrorTotal.inc({
                service: process.env.SERVICE_NAME || 'unknown',
                event_type: this.subject,
                queue_group: this.queueGroupName,
                outcome: 'shadow'
            });
            await redisWrapper.client.set(envScopedKey(`${PERMANENT_SHADOW_KEY_PREFIX}${this.subject}:${eventId}`), '1', { EX: PERMANENT_SHADOW_TTL_SEC });
        } catch (error) {
            logger.warn(`Failed to mark permanent error shadow: ${this.subject}:${eventId}`, error);
        }
    }

    /**
     * Yeniden teslimde (ya da DLQ oynatmasında, `msg` yok) başarı: olay önceden kalıcı sayıldıysa 'recovered' sayılır —
     * fail-fast açık olsaydı bu olay kaybolurdu. Faz 2'de (açma kararı) bu sayacın sıfır kalması aranır. Redis hatası yutulur.
     */
    private async recordPermanentShadowRecovery(eventId: string, msg?: Message): Promise<void> {
        if (msg && (typeof msg.isRedelivered !== 'function' || !msg.isRedelivered())) {
            return;
        }
        try {
            const removed = await redisWrapper.client.del(envScopedKey(`${PERMANENT_SHADOW_KEY_PREFIX}${this.subject}:${eventId}`));
            if (removed > 0) {
                logger.warn(`Event classified as permanent succeeded on redelivery (fail-fast would have dropped it): ${this.subject}:${eventId}`);
                EventMetrics.eventPermanentErrorTotal.inc({
                    service: process.env.SERVICE_NAME || 'unknown',
                    event_type: this.subject,
                    queue_group: this.queueGroupName,
                    outcome: 'recovered'
                });
            }
        } catch (error) {
            logger.warn(`Failed to check permanent error shadow: ${this.subject}:${eventId}`, error);
        }
    }

    /**
     * processEvent'i koşar; E11000'de en fazla duplicateKeyRetries kez süreç içinde yeniden koşar (UC-1020).
     * Yarış: çakışan yazım kaydı oluşturmuştur, yeniden koşumda handler'ın findOne'ı onu bulur → başarı ('resolved').
     * Gerçek çift: E11000 her koşumda tekrarlar → son hata fırlatılır, çağıran eskisi gibi ack'ler.
     * E11000 dışındaki hatalar hiç yeniden koşulmadan fırlatılır (NATS yeniden denemesi ve DLQ yolu değişmez).
     */
    private async processEventWithDuplicateKeyRetries(data: T['data'], eventId: string): Promise<void> {
        for (let attempt = 0; ; attempt++) {
            try {
                await this.processEvent(data);
                if (attempt > 0) {
                    logger.info(`Duplicate key race resolved on in-process rerun ${attempt}/${this.options.duplicateKeyRetries}: ${this.subject}:${eventId}`);
                    EventMetrics.eventDuplicateKeyTotal.inc({
                        service: process.env.SERVICE_NAME || 'unknown',
                        event_type: this.subject,
                        queue_group: this.queueGroupName,
                        outcome: 'resolved'
                    });
                }
                return;
            } catch (error) {
                if (attempt >= this.options.duplicateKeyRetries || !isDuplicateKeyError(error)) {
                    throw error;
                }
                logger.warn(`Duplicate key error, rerunning in process ${attempt + 1}/${this.options.duplicateKeyRetries}: ${this.subject}:${eventId}`);
                // Kısa jitter: çakışan yazımın kalan adımlarına (aynı partideki sonraki kayıtlar) zaman tanır
                await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
            }
        }
    }

    /**
     * Anlık tekrar denemelerle işlemi gerçekleştir
     */
    private async processWithImmediateRetries(data: T['data'], msg: Message, span: any): Promise<void> {
        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= this.options.immediateRetries; attempt++) {
            try {
                // Ana işlem metodu
                await this.processEvent(data);
                span.setTag('immediate_retry.success', true);
                span.setTag('immediate_retry.attempt', attempt);
                return; // Başarılı olduğunda hemen dön
            } catch (error) {
                lastError = error as Error;
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
     * DLQ kaydını bu süreçte, bu listener'ın işleme yoluyla bir kez daha işler (issue #648 DLQ-H).
     * NATS'e yayın yapmaz, mesaj ack'lemez ve yeni DLQ kaydı yazmaz; kaydı DeadLetterProcessorJob günceller.
     * - `processed`: işlendi. Duplicate key hatası da canlı yoldaki gibi işlenmiş sayılır.
     * - `busy`: işleme başlayamadı (olay kilitli ya da kilit alınamadı); deneme bütçesi tüketilmez. DeadLetterProcessorJob
     *   zaman sınırını aşan oynatmayı da, işleme başlamış olsa bile, `busy` sayar.
     * - `failed`: işleme hata verdi; bütçeden bir deneme düşülür.
     */
    public async replayDeadLetter(data: T['data']): Promise<DeadLetterReplayResult> {
        const eventType = this.subject;
        const eventId = this.getEventId(data);
        let started = false;
        const run = async () => {
            started = true;
            await this.processEventWithDuplicateKeyRetries(data, eventId);
        };

        try {
            if (this.options.enableLock) {
                await this.processWithLock(eventId, run, this.getPayloadFingerprint(data));
            } else {
                await run();
            }
        } catch (error) {
            if (!started) {
                logger.info(`Dead letter replay postponed, processing could not start: ${eventType}:${eventId}: ${this.describeError(error)}`);
                return 'busy';
            }
            if (isDuplicateKeyError(error)) {
                logger.info(`Dead letter replay treated as processed - duplicate key: ${eventType}:${eventId}`);
                return 'processed';
            }
            logger.error(`Dead letter replay failed: ${eventType}:${eventId}:`, error);
            return 'failed';
        }

        try {
            await this.retryManager.resetRetryCount(eventType, eventId);
        } catch (resetError) {
            // Olay işlendi; sayaç sıfırlanamazsa Redis TTL'i dolunca silinir
            logger.warn(`Failed to reset retry count after dead letter replay: ${eventType}:${eventId}`, resetError);
        }
        await this.recordPermanentShadowRecovery(eventId);
        logger.info(`Dead letter replay processed: ${eventType}:${eventId}`);
        return 'processed';
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
    private async moveToDeadLetterQueue(data: T['data'], errorMessage: string, retryCount: number, permanent = false): Promise<void> {
        // Mikroservis özelinde bağlantı durumunu kontrol et
        if (this.connection.readyState !== 1) {
            throw new Error(`MongoDB bağlantısı hazır değil, DeadLetter kaydedilemedi - readyState: ${this.connection.readyState}`);
        }

        const deadLetterModel = createDeadLetterModel(this.connection);
        const eventId = this.getEventId(data);
        const attemptBudget = this.options.maxRetries + this.options.deadLetterMaxRetries;
        // Kalıcı hata (UC-1043) oynatılmaz: oynatma da aynı hatayı verir
        const replayable = !permanent && retryCount < attemptBudget;

        await deadLetterModel.build({
            subject: this.subject,
            eventId: eventId,
            data: data,
            error: errorMessage,
            retryCount: retryCount,
            maxRetries: attemptBudget,
            status: replayable ? 'queued' : 'failed',
            listenerKey: buildListenerKey(this.subject, this.queueGroupName),
            queueGroupName: this.queueGroupName,
            service: process.env.SERVICE_NAME || 'unknown',
            nextRetryAt: new Date(Date.now() + this.getDeadLetterReplayDelay(retryCount)),
            timestamp: new Date()
        }).save();

        if (replayable) {
            logger.info(`Event moved to DLQ: ${this.subject}:${eventId} (attempt ${retryCount}/${attemptBudget})`);
        } else {
            logger.error(`Event permanently failed, DLQ record will not be replayed: ${this.subject}:${eventId} (attempt ${retryCount}/${attemptBudget})`);
        }
    }

    /**
     * DLQ oynatmaları arasındaki bekleme: 1, 2, 4, 8, 16 dk ... (üst sınır 30 dk).
     * `retryCount` olayın toplam başarısız deneme sayısıdır; ilk `maxRetries` deneme NATS teslimidir, gerisi oynatmadır.
     */
    public getDeadLetterReplayDelay(retryCount: number): number {
        const replaysSoFar = Math.max(retryCount - this.options.maxRetries, 0);
        return Math.min(60000 * Math.pow(2, replaysSoFar), 30 * 60000);
    }

    /**
     * Olaydan benzersiz bir ID çıkar
     * Alt sınıflar tarafından override edilebilir
     */
    protected getEventId(data: T['data']): string {
        // Yaygın ID formatları
        if ((data as any).id) return (data as any).id;
        if ((data as any).list && (data as any).list[0]?.id) return (data as any).list[0].id;

        // Özel ID oluştur (hash benzeri)
        return `${this.subject}-${JSON.stringify(data).slice(0, 50).replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}`;
    }

    /**
     * Olay içeriğinin parmak izi. Aynı eventId altında kopya teslimi farklı olaydan ayırmak için kilit değerine yazılır.
     */
    private getPayloadFingerprint(data: T['data']): string {
        return crypto.createHash('sha1').update(JSON.stringify(data) ?? '').digest('hex');
    }

    /**
     * İzleme için span oluştur
     */
    protected createTraceSpan(eventType: string, eventId: string): any {
        try {
            const { tracer } = require('../../services/tracer');
            const span = tracer.startSpan(`${eventType}-listener`);
            span.setTag('event.type', eventType);
            span.setTag('event.id', eventId);
            return span;
        } catch (error) {
            // Mock span döndür
            return {
                setTag: () => { },
                finish: () => { }
            };
        }
    }

    /**
     * Alt sınıflar tarafından uygulanması gereken asıl olay işleme metodu
     */
    protected abstract processEvent(data: T['data']): Promise<void>;

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
    private extractHttpStatusCode(error: any): number {
        const candidates = [
            error?.response?.status,
            error?.statusCode,
            error?.status
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
    protected isTransientError(error: any): boolean {
        try {
            // Hata mesajı içeriği
            const errorMessage = (error?.message || '').toLowerCase();

            // 0. İptal edilmiş istek: çağıran vazgeçti, yeniden denemek yanlış.
            // Durum kodu taşımaz, bu yüzden aşağıdaki desen katmanından ÖNCE ele alınır;
            // aksi halde axios'un bazı iptal metinleri 'aborted' desenine takılıp geçici sayılır.
            if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') {
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

        } catch (analyzeError) {
            // Hata analizi sırasında bir hata olursa - en güvenli: retry yapma
            console.error('Error while analyzing error type:', analyzeError);
            return false;
        }
    }

    /**
     * Hatanın metnini döndürür. Mesajsız Error ya da Error olmayan bir throw için de boş olmayan metin üretir:
     * DeadLetter şemasında `error` zorunlu alandır ve boş metin kaydı geçersiz kılar.
     */
    private describeError(error: unknown): string {
        const message = (error as { message?: unknown } | null | undefined)?.message;
        return (typeof message === 'string' && message) || String(error) || 'Unknown error';
    }
}
