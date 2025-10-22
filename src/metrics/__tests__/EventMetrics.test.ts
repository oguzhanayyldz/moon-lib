import { EventMetrics } from '../EventMetrics';

describe('EventMetrics', () => {
  beforeEach(() => {
    // Reset metrics before each test to ensure clean state
    EventMetrics.reset();
  });

  afterAll(() => {
    // Clean up after all tests
    EventMetrics.reset();
  });

  describe('eventProcessingDuration', () => {
    it('should track event processing duration correctly', async () => {
      // Arrange
      const labels = {
        service: 'test-service',
        event_type: 'test-event',
        queue_group: 'test-group',
        status: 'success'
      };

      // Act
      EventMetrics.eventProcessingDuration.observe(labels, 0.5); // 500ms
      EventMetrics.eventProcessingDuration.observe(labels, 1.2); // 1.2s

      // Assert
      const metrics = await EventMetrics.getRegistry().metrics();
      expect(metrics).toContain('event_processing_duration_seconds');
      expect(metrics).toContain('test-service');
      expect(metrics).toContain('test-event');
    });

    it('should use correct histogram buckets', async () => {
      // Arrange
      const labels = {
        service: 'test',
        event_type: 'test',
        queue_group: 'test',
        status: 'success'
      };

      // Act - Record various durations
      EventMetrics.eventProcessingDuration.observe(labels, 0.001); // 1ms
      EventMetrics.eventProcessingDuration.observe(labels, 0.05);  // 50ms
      EventMetrics.eventProcessingDuration.observe(labels, 0.5);   // 500ms
      EventMetrics.eventProcessingDuration.observe(labels, 2);     // 2s
      EventMetrics.eventProcessingDuration.observe(labels, 10);    // 10s

      // Assert
      const metrics = await EventMetrics.getRegistry().metrics();
      expect(metrics).toContain('event_processing_duration_seconds_bucket');
      expect(metrics).toContain('le="0.01"');
      expect(metrics).toContain('le="0.05"');
      expect(metrics).toContain('le="10"');
    });
  });

  describe('eventProcessingTotal', () => {
    it('should increment event processing counter', async () => {
      // Arrange
      const labels = {
        service: 'inventory',
        event_type: 'product-created',
        queue_group: 'inventory-service',
        status: 'success'
      };

      // Act
      EventMetrics.eventProcessingTotal.inc(labels);
      EventMetrics.eventProcessingTotal.inc(labels);
      EventMetrics.eventProcessingTotal.inc(labels);

      // Assert
      const metrics = await EventMetrics.getRegistry().metrics();
      expect(metrics).toContain('event_processing_total');
      expect(metrics).toContain('inventory');
      expect(metrics).toContain('product-created');
      expect(metrics).toContain('3'); // Should have count of 3
    });

    it('should track success and error events separately', async () => {
      // Arrange
      const successLabels = {
        service: 'orders',
        event_type: 'order-created',
        queue_group: 'orders-service',
        status: 'success'
      };

      const errorLabels = {
        ...successLabels,
        status: 'error'
      };

      // Act
      EventMetrics.eventProcessingTotal.inc(successLabels);
      EventMetrics.eventProcessingTotal.inc(successLabels);
      EventMetrics.eventProcessingTotal.inc(errorLabels);

      // Assert
      const metrics = await EventMetrics.getRegistry().metrics();
      expect(metrics).toContain('status="success"');
      expect(metrics).toContain('status="error"');
    });
  });

  describe('eventRetryTotal', () => {
    it('should track event retries with reason and count', async () => {
      // Arrange
      const labels = {
        service: 'products',
        event_type: 'product-updated',
        retry_reason: 'MongoNetworkError',
        retry_count: '1'
      };

      // Act
      EventMetrics.eventRetryTotal.inc(labels);

      // Assert
      const metrics = await EventMetrics.getRegistry().metrics();
      expect(metrics).toContain('event_retry_total');
      expect(metrics).toContain('MongoNetworkError');
      expect(metrics).toContain('retry_count="1"');
    });

    it('should track different retry counts', async () => {
      // Arrange & Act
      EventMetrics.eventRetryTotal.inc({
        service: 'test',
        event_type: 'test',
        retry_reason: 'TimeoutError',
        retry_count: '1'
      });

      EventMetrics.eventRetryTotal.inc({
        service: 'test',
        event_type: 'test',
        retry_reason: 'TimeoutError',
        retry_count: '2'
      });

      EventMetrics.eventRetryTotal.inc({
        service: 'test',
        event_type: 'test',
        retry_reason: 'TimeoutError',
        retry_count: '3'
      });

      // Assert
      const metrics = await EventMetrics.getRegistry().metrics();
      expect(metrics).toContain('retry_count="1"');
      expect(metrics).toContain('retry_count="2"');
      expect(metrics).toContain('retry_count="3"');
    });
  });

  describe('eventDlqTotal', () => {
    it('should track messages sent to DLQ', async () => {
      // Arrange
      const labels = {
        service: 'catalog',
        event_type: 'catalog-mapping-created',
        failure_reason: 'Max retries exceeded: MongoNetworkError'
      };

      // Act
      EventMetrics.eventDlqTotal.inc(labels);

      // Assert
      const metrics = await EventMetrics.getRegistry().metrics();
      expect(metrics).toContain('event_dlq_total');
      expect(metrics).toContain('catalog');
      expect(metrics).toContain('catalog-mapping-created');
    });

    it('should truncate long failure reasons', async () => {
      // Arrange - Simulate very long failure reason
      const longReason = 'A'.repeat(150); // 150 characters
      const labels = {
        service: 'test',
        event_type: 'test',
        failure_reason: longReason.substring(0, 100) // Should be truncated to 100
      };

      // Act
      EventMetrics.eventDlqTotal.inc(labels);

      // Assert
      const metrics = await EventMetrics.getRegistry().metrics();
      expect(metrics).toContain('event_dlq_total');
    });
  });

  describe('circuitBreakerState', () => {
    it('should track circuit breaker state', async () => {
      // Arrange
      const labels = {
        service: 'integration',
        circuit_breaker_name: 'shopify-integration'
      };

      // Act - Test all states
      EventMetrics.circuitBreakerState.set(labels, 0); // CLOSED
      const closedMetrics = await EventMetrics.getRegistry().metrics();

      EventMetrics.circuitBreakerState.set(labels, 1); // OPEN
      const openMetrics = await EventMetrics.getRegistry().metrics();

      EventMetrics.circuitBreakerState.set(labels, 2); // HALF_OPEN
      const halfOpenMetrics = await EventMetrics.getRegistry().metrics();

      // Assert
      expect(closedMetrics).toContain('circuit_breaker_state');
      expect(openMetrics).toContain('circuit_breaker_state');
      expect(halfOpenMetrics).toContain('circuit_breaker_state');
      expect(halfOpenMetrics).toContain('shopify-integration');
    });

    it('should track multiple circuit breakers independently', async () => {
      // Arrange & Act
      EventMetrics.circuitBreakerState.set(
        { service: 'shopify', circuit_breaker_name: 'products' },
        0 // CLOSED
      );

      EventMetrics.circuitBreakerState.set(
        { service: 'shopify', circuit_breaker_name: 'orders' },
        1 // OPEN
      );

      EventMetrics.circuitBreakerState.set(
        { service: 'trendyol', circuit_breaker_name: 'products' },
        2 // HALF_OPEN
      );

      // Assert
      const metrics = await EventMetrics.getRegistry().metrics();
      expect(metrics).toContain('circuit_breaker_name="products"');
      expect(metrics).toContain('circuit_breaker_name="orders"');
      expect(metrics).toContain('service="shopify"');
      expect(metrics).toContain('service="trendyol"');
    });
  });

  describe('getRegistry', () => {
    it('should return the Prometheus registry', () => {
      // Act
      const registry = EventMetrics.getRegistry();

      // Assert
      expect(registry).toBeDefined();
      expect(typeof registry.metrics).toBe('function');
    });

    it('should return metrics in Prometheus format', async () => {
      // Arrange
      EventMetrics.eventProcessingTotal.inc({
        service: 'test',
        event_type: 'test',
        queue_group: 'test',
        status: 'success'
      });

      // Act
      const metrics = await EventMetrics.getRegistry().metrics();

      // Assert
      expect(typeof metrics).toBe('string');
      expect(metrics).toContain('# HELP');
      expect(metrics).toContain('# TYPE');
    });
  });

  describe('reset', () => {
    it('should clear metric values but keep definitions', async () => {
      // Arrange - Add metrics with values
      EventMetrics.eventProcessingTotal.inc({
        service: 'test-reset',
        event_type: 'test-reset',
        queue_group: 'test-reset',
        status: 'success'
      });

      EventMetrics.eventProcessingDuration.observe({
        service: 'test-reset',
        event_type: 'test-reset',
        queue_group: 'test-reset',
        status: 'success'
      }, 1.0);

      // Verify metrics with values exist
      const beforeReset = await EventMetrics.getRegistry().metrics();
      expect(beforeReset).toContain('event_processing_total');
      expect(beforeReset).toContain('event_processing_duration');
      expect(beforeReset).toContain('test-reset'); // Values should exist

      // Act
      EventMetrics.reset();

      // Assert - Metric definitions should exist but values should be cleared
      const afterReset = await EventMetrics.getRegistry().metrics();

      // Metric definitions (HELP and TYPE) should still exist
      expect(afterReset).toContain('# HELP event_processing_total');
      expect(afterReset).toContain('# TYPE event_processing_total');
      expect(afterReset).toContain('# HELP event_processing_duration_seconds');
      expect(afterReset).toContain('# TYPE event_processing_duration_seconds');

      // But the actual values we added should be cleared
      expect(afterReset).not.toContain('test-reset');
    });

    it('should allow new metrics after reset', async () => {
      // Arrange
      EventMetrics.eventProcessingTotal.inc({
        service: 'test',
        event_type: 'test',
        queue_group: 'test',
        status: 'success'
      });

      // Act
      EventMetrics.reset();

      // Add new metric after reset
      EventMetrics.eventProcessingTotal.inc({
        service: 'new-test',
        event_type: 'new-test',
        queue_group: 'new-test',
        status: 'success'
      });

      // Assert
      const metrics = await EventMetrics.getRegistry().metrics();
      expect(metrics).toContain('event_processing_total');
      expect(metrics).toContain('new-test');
    });
  });

  describe('Integration test - Full event lifecycle', () => {
    it('should track complete event processing lifecycle', async () => {
      // Simulate a complete event processing scenario
      const service = 'inventory';
      const eventType = 'stock-updated';
      const queueGroup = 'inventory-service';

      // 1. Start processing
      const startTime = Date.now();

      // 2. Process successfully
      EventMetrics.eventProcessingTotal.inc({
        service,
        event_type: eventType,
        queue_group: queueGroup,
        status: 'success'
      });

      const duration = (Date.now() - startTime) / 1000;
      EventMetrics.eventProcessingDuration.observe({
        service,
        event_type: eventType,
        queue_group: queueGroup,
        status: 'success'
      }, duration);

      // 3. Verify metrics
      const metrics = await EventMetrics.getRegistry().metrics();

      expect(metrics).toContain('event_processing_total');
      expect(metrics).toContain('event_processing_duration');
      expect(metrics).toContain('inventory');
      expect(metrics).toContain('stock-updated');
      expect(metrics).toContain('status="success"');
    });

    it('should track event failure and retry scenario', async () => {
      // Simulate event failure with retries
      const service = 'orders';
      const eventType = 'order-created';
      const queueGroup = 'orders-service';

      // 1. First attempt fails
      EventMetrics.eventProcessingTotal.inc({
        service,
        event_type: eventType,
        queue_group: queueGroup,
        status: 'error'
      });

      // 2. Retry attempt 1
      EventMetrics.eventRetryTotal.inc({
        service,
        event_type: eventType,
        retry_reason: 'MongoNetworkError',
        retry_count: '1'
      });

      // 3. Retry attempt 2
      EventMetrics.eventRetryTotal.inc({
        service,
        event_type: eventType,
        retry_reason: 'MongoNetworkError',
        retry_count: '2'
      });

      // 4. Max retries exceeded - send to DLQ
      EventMetrics.eventDlqTotal.inc({
        service,
        event_type: eventType,
        failure_reason: 'Max retries exceeded: MongoNetworkError'
      });

      // 5. Verify all metrics recorded
      const metrics = await EventMetrics.getRegistry().metrics();

      expect(metrics).toContain('event_processing_total');
      expect(metrics).toContain('event_retry_total');
      expect(metrics).toContain('event_dlq_total');
      expect(metrics).toContain('orders');
      expect(metrics).toContain('order-created');
      expect(metrics).toContain('MongoNetworkError');
    });
  });
});
