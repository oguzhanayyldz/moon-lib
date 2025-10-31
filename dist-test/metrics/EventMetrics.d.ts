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
     * Circuit breaker durumu (Gauge)
     *
     * Tracks circuit breaker state per service and listener.
     * Values: 0=CLOSED, 1=OPEN, 2=HALF_OPEN
     * Includes labels: service, circuit_breaker_name
     */
    static readonly circuitBreakerState: Gauge<"service" | "circuit_breaker_name">;
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
//# sourceMappingURL=EventMetrics.d.ts.map