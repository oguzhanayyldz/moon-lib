import { Counter, Histogram, Gauge, Registry } from 'prom-client';
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
export declare class EventMetrics {
    private static registry;
    /**
     * Event işlem süresi (Histogram)
     *
     * Tracks how long it takes to process an event from receipt to completion.
     * Includes labels: service, event_type, queue_group, status
     * Buckets: 10ms -> 10s
     */
    static readonly eventProcessingDuration: Histogram<"status" | "service" | "event_type" | "queue_group">;
    /**
     * Toplam event sayısı (Counter)
     *
     * Counts total number of events processed, categorized by status (success/error).
     * Includes labels: service, event_type, queue_group, status
     */
    static readonly eventProcessingTotal: Counter<"status" | "service" | "event_type" | "queue_group">;
    /**
     * Retry sayısı (Counter)
     *
     * Tracks how many times events are retried before success or DLQ.
     * Includes labels: service, event_type, retry_reason, retry_count
     */
    static readonly eventRetryTotal: Counter<"service" | "event_type" | "retry_reason" | "retry_count">;
    /**
     * DLQ'ya gönderilen event'ler (Counter)
     *
     * Counts events sent to Dead Letter Queue after max retries exceeded.
     * Includes labels: service, event_type, failure_reason
     */
    static readonly eventDlqTotal: Counter<"service" | "event_type" | "failure_reason">;
    /**
     * DLQ kaydı yazılamayan event'ler (Counter)
     *
     * Counts events whose dead-letter record could not be written after max retries (issue #648).
     * reason=invalid: the record fails schema validation; the message is acked without a record.
     * reason=unavailable: the write failed (e.g. Mongo not ready); the message is not acked and NATS redelivers it.
     * Includes labels: service, event_type, reason
     */
    static readonly eventDlqWriteErrorTotal: Counter<"service" | "event_type" | "reason">;
    /**
     * DLQ oynatmaları (Counter)
     *
     * Counts targeted dead-letter replays (issue #648 DLQ-H) by result:
     * processed (record completed), failed (one attempt of the budget used), busy (no attempt used, retried a minute later):
     * the event was locked, or the replay exceeded the 10 minute limit and its handler still runs in the background.
     * Both busy cases share the label; only the processor's warning log tells a timeout apart.
     * Includes labels: service, event_type, queue_group, result
     */
    static readonly eventDlqReplayTotal: Counter<"service" | "event_type" | "queue_group" | "result">;
    /**
     * Circuit breaker durumu (Gauge)
     *
     * Tracks circuit breaker state per service and listener.
     * Values: 0=CLOSED, 1=OPEN, 2=HALF_OPEN
     * Includes labels: service, circuit_breaker_name
     */
    static readonly circuitBreakerState: Gauge<"service" | "circuit_breaker_name">;
    /**
     * Yayınlanan sürüm olayı sayısı (Counter) — UC-984
     *
     * EventPublisherJob toplu sürüm yayınında NATS onayı alınan her olay için artar. sync tarafındaki
     * sync_version_updates_total ile karşılaştırılır: üretilen = sync'e ulaşan.
     * Labels: service (yayıncı servis)
     */
    static readonly outboxVersionEventsPublishedTotal: Counter<"service">;
    /**
     * Birleştirilen sürüm olayı (Counter) — UC-984 madde 8
     *
     * stage=write: yeni satır açılmadı, bekleyen satır güncellendi (writeVersionEventToOutbox).
     * stage=send: aynı partide aynı varlığın daha yüksek sürümü gönderildi, satır 'superseded' oldu.
     * Birleştirme oranı = coalesced / (coalesced + published). Kayıp DEĞİLDİR: en son sürüm yine gider.
     * Labels: service, stage
     */
    static readonly versionEventsCoalescedTotal: Counter<"service" | "stage">;
    /**
     * Redis iletim kirası tutulan varlık sayısı (Gauge) — UC-984 madde 9
     *
     * Bu pod'un şu an yayınlamakta olduğu (kirasını tuttuğu) varlık sayısı; parti bitince 0'a döner.
     * Labels: service
     */
    static readonly versionEventsInflight: Gauge<"service">;
    /**
     * Süresi dolmuş iletim kirası (Counter) — UC-984 madde 9
     *
     * Yayın bittiğinde kira artık bu pod'un değil: kira süresi (VERSION_EVENT_LEASE_MS) yayından kısa kalmış.
     * Kayıp değildir (Mongo kaydı yine işaretlenir); sürekli artıyorsa kira süresini büyüt.
     * Labels: service
     */
    static readonly versionEventsLeaseExpiredTotal: Counter<"service">;
    /**
     * Önlenen çift gönderim (Counter) — UC-984 madde 9
     *
     * reason=inflight: varlık o an başka bir partide iletimde, satır pending'e geri bırakıldı (sonraki turda gider).
     * reason=delivered: satırın sürümü sync'e zaten gönderilmiş sürümden büyük değil, 'superseded' oldu.
     * Labels: service, reason
     */
    static readonly versionEventsDuplicatePreventedTotal: Counter<"service" | "reason">;
    /**
     * Redis'e ulaşılamayan parti (Counter) — UC-984 madde 9
     *
     * Kira alınamadı/bırakılamadı; gönderim yalnız Mongo claim'iyle sürdü (olay kaybı yok, çift gönderim olabilir).
     * Labels: service
     */
    static readonly versionEventsLeaseUnavailableTotal: Counter<"service">;
    /**
     * Outbox'a yazılamayan sürüm olayı (Counter) — UC-984
     *
     * base şemanın post-save kancası Outbox kaydını ayrı yazar; yazım hata verirse olay kaybolur.
     * Bu sayaç sıfırdan büyükse sync'teki sürüm o varlık için bir sonraki kayda kadar geride kalır.
     * Labels: service, entity_type
     */
    static readonly versionEventWriteErrorsTotal: Counter<"service" | "entity_type">;
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
    static readonly outboxVersionRecords: Gauge<"status" | "service">;
    static readonly outboxVersionOldestPendingAge: Gauge<"service">;
    static readonly outboxUnrecoveredRecords: Gauge<"service" | "reason">;
    private static outboxCollector;
    private static pendingSnapshot;
    private static readonly SNAPSHOT_TTL_MS;
    /** EventPublisherJob kendi outbox'ının toplayıcısını kaydeder (süreçte bir yayıncı: sonuncusu geçerlidir). */
    static setOutboxCollector(service: string, collect: () => Promise<OutboxMetricsSnapshot>): void;
    private static readOutboxSnapshot;
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
    static getRegistry(): Registry;
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
    static reset(): void;
}
/** EventPublisherJob'un outbox toplayıcısının döndürdüğü anlık durum (UC-984). */
export interface OutboxMetricsSnapshot {
    versionRecords: {
        pending: number;
        processing: number;
        failed: number;
    };
    versionOldestPendingAgeSeconds: number;
    stuckProcessing: number;
    failedFinal: number;
}
