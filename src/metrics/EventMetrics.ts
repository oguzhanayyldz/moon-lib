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
  }
}
