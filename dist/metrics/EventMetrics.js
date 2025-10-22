"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventMetrics = void 0;
const prom_client_1 = require("prom-client");
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
        // Note: Gauge values will remain until explicitly set again
        // Clear registry and re-register all metrics
        EventMetrics.registry.clear();
        EventMetrics.registry.registerMetric(EventMetrics.eventProcessingDuration);
        EventMetrics.registry.registerMetric(EventMetrics.eventProcessingTotal);
        EventMetrics.registry.registerMetric(EventMetrics.eventRetryTotal);
        EventMetrics.registry.registerMetric(EventMetrics.eventDlqTotal);
        EventMetrics.registry.registerMetric(EventMetrics.circuitBreakerState);
    }
}
exports.EventMetrics = EventMetrics;
EventMetrics.registry = new prom_client_1.Registry();
/**
 * Event işlem süresi (Histogram)
 *
 * Tracks how long it takes to process an event from receipt to completion.
 * Includes labels: service, event_type, queue_group, status
 * Buckets: 10ms -> 10s
 */
EventMetrics.eventProcessingDuration = new prom_client_1.Histogram({
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
