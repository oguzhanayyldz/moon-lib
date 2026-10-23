import { Counter, Histogram, Gauge, Registry } from 'prom-client';
import { logger } from '../services/logger.service';

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
export class EventMetrics {
  private static registry: Registry = new Registry();

  /**
   * Event işlem süresi (Histogram)
   *
   * Tracks how long it takes to process an event from receipt to completion.
   * Includes labels: service, event_type, queue_group, status
   * Buckets: 10ms -> 10s
   */
  static readonly eventProcessingDuration = new Histogram({
    name: 'event_processing_duration_seconds',
    help: 'Duration of event processing in seconds',
    labelNames: ['service', 'event_type', 'queue_group', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10], // 10ms -> 10s
    registers: [EventMetrics.registry]
  });

  /**
   * Toplam event sayısı (Counter)
   *
   * Counts total number of events processed, categorized by status (success/error).
   * Includes labels: service, event_type, queue_group, status
   */
  static readonly eventProcessingTotal = new Counter({
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
  static readonly eventRetryTotal = new Counter({
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
  static readonly eventDlqTotal = new Counter({
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
  static readonly eventDlqWriteErrorTotal = new Counter<'service' | 'event_type' | 'reason'>({
    name: 'event_dlq_write_error_total',
    help: 'Total number of dead letter records that could not be written',
    labelNames: ['service', 'event_type', 'reason'],
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
  static readonly eventDlqReplayTotal = new Counter<'service' | 'event_type' | 'queue_group' | 'result'>({
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
  static readonly circuitBreakerState = new Gauge({
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
  static readonly outboxVersionEventsPublishedTotal = new Counter<'service'>({
    name: 'outbox_version_events_published_total',
    help: 'Total number of entity version events published to NATS',
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
  static readonly versionEventWriteErrorsTotal = new Counter<'service' | 'entity_type'>({
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
  static readonly outboxVersionRecords = new Gauge<'service' | 'status'>({
    name: 'outbox_version_records',
    help: 'Number of entity version outbox records by status',
    labelNames: ['service', 'status'],
    registers: [EventMetrics.registry],
    async collect() {
      const snapshot = await EventMetrics.readOutboxSnapshot();
      this.reset();
      if (!snapshot) return;
      for (const [status, count] of Object.entries(snapshot.versionRecords)) {
        this.set({ service: snapshot.service, status }, count);
      }
    }
  });

  static readonly outboxVersionOldestPendingAge = new Gauge<'service'>({
    name: 'outbox_version_oldest_pending_age_seconds',
    help: 'Age in seconds of the oldest unpublished entity version outbox record (0 when none)',
    labelNames: ['service'],
    registers: [EventMetrics.registry],
    async collect() {
      const snapshot = await EventMetrics.readOutboxSnapshot();
      this.reset();
      if (!snapshot) return;
      this.set({ service: snapshot.service }, snapshot.versionOldestPendingAgeSeconds);
    }
  });

  static readonly outboxUnrecoveredRecords = new Gauge<'service' | 'reason'>({
    name: 'outbox_unrecovered_records',
    help: 'Outbox records that will not be published without manual action, by reason',
    labelNames: ['service', 'reason'],
    registers: [EventMetrics.registry],
    async collect() {
      const snapshot = await EventMetrics.readOutboxSnapshot();
      this.reset();
      if (!snapshot) return;
      this.set({ service: snapshot.service, reason: 'processing_stuck' }, snapshot.stuckProcessing);
      this.set({ service: snapshot.service, reason: 'failed_final' }, snapshot.failedFinal);
    }
  });

  private static outboxCollector: { service: string; collect: () => Promise<OutboxMetricsSnapshot> } | null = null;
  private static pendingSnapshot: { at: number; promise: Promise<(OutboxMetricsSnapshot & { service: string }) | null> } | null = null;
  // Aynı scrape'teki üç gauge tek sorgu turunu paylaşır
  private static readonly SNAPSHOT_TTL_MS = 2000;

  /** EventPublisherJob kendi outbox'ının toplayıcısını kaydeder (süreçte bir yayıncı: sonuncusu geçerlidir). */
  static setOutboxCollector(service: string, collect: () => Promise<OutboxMetricsSnapshot>): void {
    EventMetrics.outboxCollector = { service, collect };
    EventMetrics.pendingSnapshot = null;
  }

  private static readOutboxSnapshot(): Promise<(OutboxMetricsSnapshot & { service: string }) | null> {
    const collector = EventMetrics.outboxCollector;
    if (!collector) return Promise.resolve(null);
    const now = Date.now();
    if (EventMetrics.pendingSnapshot && now - EventMetrics.pendingSnapshot.at < EventMetrics.SNAPSHOT_TTL_MS) {
      return EventMetrics.pendingSnapshot.promise;
    }
    // Sorgu hatası scrape'i düşürmez: seri o turda yazılmaz (alarm "veri yok" ile değil eşikle çalışır)
    const promise = collector.collect()
      .then(snapshot => ({ ...snapshot, service: collector.service }))
      .catch(error => {
        logger.warn(`Outbox metrics collection failed: ${error instanceof Error ? error.message : String(error)}`);
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
  static getRegistry(): Registry {
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
  static reset(): void {
    // Reset all metric values first
    EventMetrics.eventProcessingDuration.reset();
    EventMetrics.eventProcessingTotal.reset();
    EventMetrics.eventRetryTotal.reset();
    EventMetrics.eventDlqTotal.reset();
    EventMetrics.eventDlqWriteErrorTotal.reset();
    EventMetrics.eventDlqReplayTotal.reset();
    EventMetrics.outboxVersionEventsPublishedTotal.reset();
    EventMetrics.versionEventWriteErrorsTotal.reset();
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
    EventMetrics.registry.registerMetric(EventMetrics.circuitBreakerState);
    EventMetrics.registry.registerMetric(EventMetrics.outboxVersionEventsPublishedTotal);
    EventMetrics.registry.registerMetric(EventMetrics.versionEventWriteErrorsTotal);
    EventMetrics.registry.registerMetric(EventMetrics.outboxVersionRecords);
    EventMetrics.registry.registerMetric(EventMetrics.outboxVersionOldestPendingAge);
    EventMetrics.registry.registerMetric(EventMetrics.outboxUnrecoveredRecords);
  }
}

/** EventPublisherJob'un outbox toplayıcısının döndürdüğü anlık durum (UC-984). */
export interface OutboxMetricsSnapshot {
  versionRecords: { pending: number; processing: number; failed: number };
  versionOldestPendingAgeSeconds: number;
  stuckProcessing: number;
  failedFinal: number;
}
