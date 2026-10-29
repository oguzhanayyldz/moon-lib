"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventMetrics = void 0;
const prom_client_1 = require("prom-client");
const logger_service_1 = require("../services/logger.service");
/**
 * Centralized Event Processing Metrics
 *
 * Provides Prometheus format metrics for NATS event processing.
 * Tracks event processing duration, counts, retries, DLQ messages, and circuit breaker states.
 *
 * @example
 * ```typescript
 * // Record event processing duration
 * EventMetrics.eventProcessingDuration.observe(
 *   { service: 'inventory', event_type: 'product-created', queue_group: 'inventory-service', status: 'success' },
 *   0.5 // 500ms
 * );
 *
 * // Increment event processing counter
 * EventMetrics.eventProcessingTotal.inc({
 *   service: 'inventory',
 *   event_type: 'product-created',
 *   queue_group: 'inventory-service',
 *   status: 'success'
 * });
 *
 * // Get all metrics in Prometheus format
 * const metrics = await EventMetrics.getRegistry().metrics();
 * ```
 */
class EventMetrics {
    /** EventPublisherJob kendi outbox'ının toplayıcısını kaydeder (süreçte bir yayıncı: sonuncusu geçerlidir). */
    static setOutboxCollector(service, collect) {
        EventMetrics.outboxCollector = { service, collect };
        EventMetrics.pendingSnapshot = null;
    }
    static readOutboxSnapshot() {
        const collector = EventMetrics.outboxCollector;
        if (!collector)
            return Promise.resolve(null);
        const now = Date.now();
        if (EventMetrics.pendingSnapshot && now - EventMetrics.pendingSnapshot.at < EventMetrics.SNAPSHOT_TTL_MS) {
            return EventMetrics.pendingSnapshot.promise;
        }
        // Sorgu hatası scrape'i düşürmez: seri o turda yazılmaz (alarm "veri yok" ile değil eşikle çalışır)
        const promise = collector.collect()
            .then(snapshot => (Object.assign(Object.assign({}, snapshot), { service: collector.service })))
            .catch(error => {
            logger_service_1.logger.warn(`Outbox metrics collection failed: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        });
        EventMetrics.pendingSnapshot = { at: now, promise };
        return promise;
    }
    /**
     * Returns the Prometheus registry containing all event metrics
     *
     * Used by metrics endpoints in each microservice to export metrics.
     *
     * @returns Registry - Prometheus registry
     *
     * @example
     * ```typescript
     * // In metrics endpoint
     * router.get('/api/service/metrics', async (req, res) => {
     *   const metrics = await EventMetrics.getRegistry().metrics();
     *   res.set('Content-Type', register.contentType);
     *   res.send(metrics);
     * });
     * ```
     */
    static getRegistry() {
        return EventMetrics.registry;
    }
    /**
     * Clears all metric values and resets the registry
     *
     * Primarily used for testing to ensure clean state between tests.
     * Should NOT be used in production code.
     *
     * @example
     * ```typescript
     * // In test setup
     * beforeEach(() => {
     *   EventMetrics.reset();
     * });
     * ```
     */
    static reset() {
        // Reset all metric values first
        EventMetrics.eventProcessingDuration.reset();
        EventMetrics.eventProcessingTotal.reset();
        EventMetrics.eventRetryTotal.reset();
        EventMetrics.eventDlqTotal.reset();
        EventMetrics.eventDlqWriteErrorTotal.reset();
        EventMetrics.eventDlqReplayTotal.reset();
        EventMetrics.eventDuplicateKeyTotal.reset();
        EventMetrics.eventPermanentErrorTotal.reset();
        EventMetrics.outboxVersionEventsPublishedTotal.reset();
        EventMetrics.versionEventWriteErrorsTotal.reset();
        EventMetrics.versionEventsCoalescedTotal.reset();
        EventMetrics.versionEventsInflight.reset();
        EventMetrics.versionEventsLeaseExpiredTotal.reset();
        EventMetrics.versionEventsDuplicatePreventedTotal.reset();
        EventMetrics.versionEventsLeaseUnavailableTotal.reset();
        EventMetrics.outboxCollector = null;
        EventMetrics.pendingSnapshot = null;
        // Note: Gauge values will remain until explicitly set again
        // Clear registry and re-register all metrics
        EventMetrics.registry.clear();
        EventMetrics.registry.registerMetric(EventMetrics.eventProcessingDuration);
        EventMetrics.registry.registerMetric(EventMetrics.eventProcessingTotal);
        EventMetrics.registry.registerMetric(EventMetrics.eventRetryTotal);
        EventMetrics.registry.registerMetric(EventMetrics.eventDlqTotal);
        EventMetrics.registry.registerMetric(EventMetrics.eventDlqWriteErrorTotal);
        EventMetrics.registry.registerMetric(EventMetrics.eventDlqReplayTotal);
        EventMetrics.registry.registerMetric(EventMetrics.eventDuplicateKeyTotal);
        EventMetrics.registry.registerMetric(EventMetrics.eventPermanentErrorTotal);
        EventMetrics.registry.registerMetric(EventMetrics.circuitBreakerState);
        EventMetrics.registry.registerMetric(EventMetrics.outboxVersionEventsPublishedTotal);
        EventMetrics.registry.registerMetric(EventMetrics.versionEventWriteErrorsTotal);
        EventMetrics.registry.registerMetric(EventMetrics.versionEventsCoalescedTotal);
        EventMetrics.registry.registerMetric(EventMetrics.versionEventsInflight);
        EventMetrics.registry.registerMetric(EventMetrics.versionEventsLeaseExpiredTotal);
        EventMetrics.registry.registerMetric(EventMetrics.versionEventsDuplicatePreventedTotal);
        EventMetrics.registry.registerMetric(EventMetrics.versionEventsLeaseUnavailableTotal);
        EventMetrics.registry.registerMetric(EventMetrics.outboxVersionRecords);
        EventMetrics.registry.registerMetric(EventMetrics.outboxVersionOldestPendingAge);
        EventMetrics.registry.registerMetric(EventMetrics.outboxUnrecoveredRecords);
    }
}
exports.EventMetrics = EventMetrics;
EventMetrics.registry = new prom_client_1.Registry();
/**
 * Event işlem süresi (Histogram)
 *
 * Tracks how long it takes to process an event from receipt to completion.
 * Includes labels: service, event_type, queue_group, status
 * Buckets: 10ms -> 120s (UC-967: toplu işlemler için 30/60/120)
 */
EventMetrics.eventProcessingDuration = new prom_client_1.Histogram({
    name: 'event_processing_duration_seconds',
    help: 'Duration of event processing in seconds',
    labelNames: ['service', 'event_type', 'queue_group', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30, 60, 120], // 10ms -> 120s
    registers: [EventMetrics.registry]
});
/**
 * Toplam event sayısı (Counter)
 *
 * Counts total number of events processed, categorized by status (success/error).
 * Includes labels: service, event_type, queue_group, status
 */
EventMetrics.eventProcessingTotal = new prom_client_1.Counter({
    name: 'event_processing_total',
    help: 'Total number of events processed',
    labelNames: ['service', 'event_type', 'queue_group', 'status'],
    registers: [EventMetrics.registry]
});
/**
 * Retry sayısı (Counter)
 *
 * Tracks how many times events are retried before success or DLQ.
 * Includes labels: service, event_type, retry_reason, retry_count
 */
EventMetrics.eventRetryTotal = new prom_client_1.Counter({
    name: 'event_retry_total',
    help: 'Total number of event retries',
    labelNames: ['service', 'event_type', 'retry_reason', 'retry_count'],
    registers: [EventMetrics.registry]
});
/**
 * DLQ'ya gönderilen event'ler (Counter)
 *
 * Counts events sent to Dead Letter Queue after max retries exceeded.
 * Includes labels: service, event_type, failure_reason
 */
EventMetrics.eventDlqTotal = new prom_client_1.Counter({
    name: 'event_dlq_total',
    help: 'Total number of events sent to dead letter queue',
    labelNames: ['service', 'event_type', 'failure_reason'],
    registers: [EventMetrics.registry]
});
/**
 * DLQ kaydı yazılamayan event'ler (Counter)
 *
 * Counts events whose dead-letter record could not be written after max retries (issue #648).
 * reason=invalid: the record fails schema validation; the message is acked without a record.
 * reason=unavailable: the write failed (e.g. Mongo not ready); the message is not acked and NATS redelivers it.
 * Includes labels: service, event_type, reason
 */
EventMetrics.eventDlqWriteErrorTotal = new prom_client_1.Counter({
    name: 'event_dlq_write_error_total',
    help: 'Total number of dead letter records that could not be written',
    labelNames: ['service', 'event_type', 'reason'],
    registers: [EventMetrics.registry]
});
/**
 * Duplicate key (E11000) sonuçları (Counter)
 *
 * Counts RetryableListener duplicate key outcomes (UC-1020).
 * outcome=acked: the message was acked without NATS retry (after duplicateKeyRetries in-process reruns, 0 by default);
 * if the handler is not idempotent the rest of the event's work is not written.
 * outcome=resolved: an in-process rerun succeeded, i.e. the E11000 was a race, not a real duplicate.
 * Includes labels: service, event_type, queue_group, outcome
 */
EventMetrics.eventDuplicateKeyTotal = new prom_client_1.Counter({
    name: 'event_duplicate_key_total',
    help: 'Total number of duplicate key errors in event listeners by outcome',
    labelNames: ['service', 'event_type', 'queue_group', 'outcome'],
    registers: [EventMetrics.registry]
});
/**
 * Kalıcı (deterministik) hatalar (Counter) — UC-1043
 *
 * outcome: failed_fast (fail-fast açık: ilk denemede 'failed' DLQ kaydı + ack), shadow (fail-fast kapalı: eski
 * yeniden deneme yolu sürer, yalnız sayılır), recovered (shadow sayılan olay sonraki teslimde BAŞARILI oldu —
 * yanlış pozitif: fail-fast açık olsaydı bu olay kaybolurdu).
 * Includes labels: service, event_type, queue_group, outcome
 */
EventMetrics.eventPermanentErrorTotal = new prom_client_1.Counter({
    name: 'event_permanent_error_total',
    help: 'Total number of deterministic (permanent) listener errors by outcome',
    labelNames: ['service', 'event_type', 'queue_group', 'outcome'],
    registers: [EventMetrics.registry]
});
/**
 * Takılı iş sayacı (Counter) — UC-1183
 *
 * reason=max_lock_hold: kilit yenilemesi maxLockHoldMs'i aştığı için durduruldu.
 * reason=redelivery: aynı mesaj kilit sahibi hâlâ işlerken N kez yeniden teslim edildi (olay başına bir kez sayılır).
 * Includes labels: listener, reason
 */
EventMetrics.retryableListenerStuckTotal = new prom_client_1.Counter({
    name: 'retryable_listener_stuck_total',
    help: 'Total number of stuck listener events (lock hold limit exceeded or repeated same-message redelivery)',
    labelNames: ['listener', 'reason'],
    registers: [EventMetrics.registry]
});
/**
 * DLQ oynatmaları (Counter)
 *
 * Counts targeted dead-letter replays (issue #648 DLQ-H) by result:
 * processed (record completed), failed (one attempt of the budget used), busy (no attempt used, retried a minute later):
 * the event was locked, or the replay exceeded the 10 minute limit and its handler still runs in the background.
 * Both busy cases share the label; only the processor's warning log tells a timeout apart.
 * Includes labels: service, event_type, queue_group, result
 */
EventMetrics.eventDlqReplayTotal = new prom_client_1.Counter({
    name: 'event_dlq_replay_total',
    help: 'Total number of dead letter replays by result',
    labelNames: ['service', 'event_type', 'queue_group', 'result'],
    registers: [EventMetrics.registry]
});
/**
 * Circuit breaker durumu (Gauge)
 *
 * Tracks circuit breaker state per service and listener.
 * Values: 0=CLOSED, 1=OPEN, 2=HALF_OPEN
 * Includes labels: service, circuit_breaker_name
 */
EventMetrics.circuitBreakerState = new prom_client_1.Gauge({
    name: 'circuit_breaker_state',
    help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
    labelNames: ['service', 'circuit_breaker_name'],
    registers: [EventMetrics.registry]
});
/**
 * Yayınlanan sürüm olayı sayısı (Counter) — UC-984
 *
 * EventPublisherJob toplu sürüm yayınında NATS onayı alınan her olay için artar. sync tarafındaki
 * sync_version_updates_total ile karşılaştırılır: üretilen = sync'e ulaşan.
 * Labels: service (yayıncı servis)
 */
EventMetrics.outboxVersionEventsPublishedTotal = new prom_client_1.Counter({
    name: 'outbox_version_events_published_total',
    help: 'Total number of entity version events published to NATS',
    labelNames: ['service'],
    registers: [EventMetrics.registry]
});
/**
 * Birleştirilen sürüm olayı (Counter) — UC-984 madde 8
 *
 * stage=write: yeni satır açılmadı, bekleyen satır güncellendi (writeVersionEventToOutbox).
 * stage=send: aynı partide aynı varlığın daha yüksek sürümü gönderildi, satır 'superseded' oldu.
 * Birleştirme oranı = coalesced / (coalesced + published). Kayıp DEĞİLDİR: en son sürüm yine gider.
 * Labels: service, stage
 */
EventMetrics.versionEventsCoalescedTotal = new prom_client_1.Counter({
    name: 'version_events_coalesced_total',
    help: 'Total number of entity version events merged into a newer pending event for the same entity',
    labelNames: ['service', 'stage'],
    registers: [EventMetrics.registry]
});
/**
 * Redis iletim kirası tutulan varlık sayısı (Gauge) — UC-984 madde 9
 *
 * Bu pod'un şu an yayınlamakta olduğu (kirasını tuttuğu) varlık sayısı; parti bitince 0'a döner.
 * Labels: service
 */
EventMetrics.versionEventsInflight = new prom_client_1.Gauge({
    name: 'version_events_inflight',
    help: 'Number of entities whose version event this pod is currently publishing (Redis lease held)',
    labelNames: ['service'],
    registers: [EventMetrics.registry]
});
/**
 * Süresi dolmuş iletim kirası (Counter) — UC-984 madde 9
 *
 * Yayın bittiğinde kira artık bu pod'un değil: kira süresi (VERSION_EVENT_LEASE_MS) yayından kısa kalmış.
 * Kayıp değildir (Mongo kaydı yine işaretlenir); sürekli artıyorsa kira süresini büyüt.
 * Labels: service
 */
EventMetrics.versionEventsLeaseExpiredTotal = new prom_client_1.Counter({
    name: 'version_events_lease_expired_total',
    help: 'Total number of version event leases that had already expired when the publish finished',
    labelNames: ['service'],
    registers: [EventMetrics.registry]
});
/**
 * Önlenen çift gönderim (Counter) — UC-984 madde 9
 *
 * reason=inflight: varlık o an başka bir partide iletimde, satır pending'e geri bırakıldı (sonraki turda gider).
 * reason=delivered: satırın sürümü sync'e zaten gönderilmiş sürümden büyük değil, 'superseded' oldu.
 * Labels: service, reason
 */
EventMetrics.versionEventsDuplicatePreventedTotal = new prom_client_1.Counter({
    name: 'version_events_duplicate_prevented_total',
    help: 'Total number of version events not published because the entity was in flight or already delivered',
    labelNames: ['service', 'reason'],
    registers: [EventMetrics.registry]
});
/**
 * Redis'e ulaşılamayan parti (Counter) — UC-984 madde 9
 *
 * Kira alınamadı/bırakılamadı; gönderim yalnız Mongo claim'iyle sürdü (olay kaybı yok, çift gönderim olabilir).
 * Labels: service
 */
EventMetrics.versionEventsLeaseUnavailableTotal = new prom_client_1.Counter({
    name: 'version_events_lease_unavailable_total',
    help: 'Total number of version event batches published without Redis leases because Redis was unavailable',
    labelNames: ['service'],
    registers: [EventMetrics.registry]
});
/**
 * Outbox'a yazılamayan sürüm olayı (Counter) — UC-984
 *
 * base şemanın post-save kancası Outbox kaydını ayrı yazar; yazım hata verirse olay kaybolur.
 * Bu sayaç sıfırdan büyükse sync'teki sürüm o varlık için bir sonraki kayda kadar geride kalır.
 * Labels: service, entity_type
 */
EventMetrics.versionEventWriteErrorsTotal = new prom_client_1.Counter({
    name: 'version_event_write_errors_total',
    help: 'Total number of entity version events that could not be written to the outbox',
    labelNames: ['service', 'entity_type'],
    registers: [EventMetrics.registry]
});
/**
 * Outbox durumu (Gauge) — UC-984. Değerler her scrape'te EventPublisherJob'un verdiği toplayıcıdan okunur;
 * toplayıcı yoksa (yayıncısı olmayan servis) seri yazılmaz.
 *
 * outbox_version_records{service,status}: pending/processing/failed sürüm olayı sayısı
 * outbox_version_oldest_pending_age_seconds{service}: en eski yayınlanmamış sürüm olayının yaşı
 * outbox_unrecovered_records{service,reason}: kendiliğinden kurtulmayacak kayıtlar (tüm olay türleri) —
 *   processing_stuck: processing'te kalmış ve otomatik kurtarma süresini aşmış
 *   failed_final: deneme hakkı bitmiş ya da yeniden deneme zamanı olmayan failed kayıt
 */
EventMetrics.outboxVersionRecords = new prom_client_1.Gauge({
    name: 'outbox_version_records',
    help: 'Number of entity version outbox records by status',
    labelNames: ['service', 'status'],
    registers: [EventMetrics.registry],
    async collect() {
        const snapshot = await EventMetrics.readOutboxSnapshot();
        this.reset();
        if (!snapshot)
            return;
        for (const [status, count] of Object.entries(snapshot.versionRecords)) {
            this.set({ service: snapshot.service, status }, count);
        }
    }
});
EventMetrics.outboxVersionOldestPendingAge = new prom_client_1.Gauge({
    name: 'outbox_version_oldest_pending_age_seconds',
    help: 'Age in seconds of the oldest unpublished entity version outbox record (0 when none)',
    labelNames: ['service'],
    registers: [EventMetrics.registry],
    async collect() {
        const snapshot = await EventMetrics.readOutboxSnapshot();
        this.reset();
        if (!snapshot)
            return;
        this.set({ service: snapshot.service }, snapshot.versionOldestPendingAgeSeconds);
    }
});
EventMetrics.outboxUnrecoveredRecords = new prom_client_1.Gauge({
    name: 'outbox_unrecovered_records',
    help: 'Outbox records that will not be published without manual action, by reason',
    labelNames: ['service', 'reason'],
    registers: [EventMetrics.registry],
    async collect() {
        const snapshot = await EventMetrics.readOutboxSnapshot();
        this.reset();
        if (!snapshot)
            return;
        this.set({ service: snapshot.service, reason: 'processing_stuck' }, snapshot.stuckProcessing);
        this.set({ service: snapshot.service, reason: 'failed_final' }, snapshot.failedFinal);
    }
});
EventMetrics.outboxCollector = null;
EventMetrics.pendingSnapshot = null;
// Aynı scrape'teki üç gauge tek sorgu turunu paylaşır
EventMetrics.SNAPSHOT_TTL_MS = 2000;
//# sourceMappingURL=EventMetrics.js.map