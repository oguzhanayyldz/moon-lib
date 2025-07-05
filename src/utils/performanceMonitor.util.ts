import { EventEmitter } from 'events';
import { 
  BatchPerformanceMetrics, 
  ResourceUsage, 
  MonitoringConfig 
} from '../common/interfaces/batch-deletion.interface';
import { logger } from '../services/logger.service';

/**
 * Performance monitoring utility for batch operations
 */
export class PerformanceMonitor extends EventEmitter {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, any> = new Map();
  private resourceUsageHistory: ResourceUsage[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private config: MonitoringConfig;
  private isMonitoring = false;

  private constructor(config: MonitoringConfig) {
    super();
    this.config = config;
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: MonitoringConfig): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor(config || {
        enabled: true,
        metricsInterval: 5000,
        alertThresholds: {
          memoryUsage: 80,
          errorRate: 10,
          processingTime: 30000
        }
      });
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start monitoring performance metrics
   */
  public startMonitoring(): void {
    if (!this.config.enabled || this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.metricsInterval);

    logger.info('Performance monitoring started', {
      interval: this.config.metricsInterval,
      thresholds: this.config.alertThresholds
    });
  }

  /**
   * Stop monitoring performance metrics
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isMonitoring = false;
    logger.info('Performance monitoring stopped');
  }

  /**
   * Collect current performance metrics
   */
  private collectMetrics(): void {
    const resourceUsage = this.getCurrentResourceUsage();
    this.resourceUsageHistory.push(resourceUsage);

    // Keep only last 1000 entries
    if (this.resourceUsageHistory.length > 1000) {
      this.resourceUsageHistory.shift();
    }

    // Check thresholds and emit alerts
    this.checkThresholds(resourceUsage);

    // Emit metrics event
    this.emit('metrics-collected', resourceUsage);
  }

  /**
   * Get current resource usage
   */
  public getCurrentResourceUsage(): ResourceUsage {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memoryUsage: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
      cpuUsage: Math.round((cpuUsage.user + cpuUsage.system) / 1000), // milliseconds
      databaseConnections: this.getMetric('database_connections', 0),
      networkConnections: this.getMetric('network_connections', 0),
      activeBatches: this.getMetric('active_batches', 0),
      timestamp: Date.now()
    };
  }

  /**
   * Check performance thresholds and emit alerts
   */
  private checkThresholds(resourceUsage: ResourceUsage): void {
    const { alertThresholds } = this.config;

    if (resourceUsage.memoryUsage > alertThresholds.memoryUsage) {
      this.emit('alert', {
        type: 'memory_threshold_exceeded',
        value: resourceUsage.memoryUsage,
        threshold: alertThresholds.memoryUsage,
        timestamp: Date.now()
      });
    }

    const errorRate = this.getMetric('error_rate', 0);
    if (errorRate > alertThresholds.errorRate) {
      this.emit('alert', {
        type: 'error_rate_threshold_exceeded',
        value: errorRate,
        threshold: alertThresholds.errorRate,
        timestamp: Date.now()
      });
    }

    const avgProcessingTime = this.getMetric('avg_processing_time', 0);
    if (avgProcessingTime > alertThresholds.processingTime) {
      this.emit('alert', {
        type: 'processing_time_threshold_exceeded',
        value: avgProcessingTime,
        threshold: alertThresholds.processingTime,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Record batch performance metrics
   */
  public recordBatchMetrics(
    operationId: string,
    metrics: BatchPerformanceMetrics
  ): void {
    const timestamp = Date.now();
    
    this.metrics.set(`batch_${operationId}`, {
      ...metrics,
      timestamp
    });

    // Update aggregated metrics
    this.updateAggregatedMetrics(metrics);

    // Emit metrics event
    this.emit('batch-metrics-recorded', {
      operationId,
      metrics,
      timestamp
    });

    logger.debug('Batch metrics recorded', {
      operationId,
      totalItems: metrics.totalItems,
      successfulDeletions: metrics.successfulDeletions,
      executionTime: metrics.totalExecutionTime,
      memoryUsage: metrics.peakMemoryUsage
    });
  }

  /**
   * Update aggregated metrics
   */
  private updateAggregatedMetrics(metrics: BatchPerformanceMetrics): void {
    // Update total operations
    const totalOps = this.getMetric('total_operations', 0);
    this.setMetric('total_operations', totalOps + 1);

    // Update success rate
    const successRate = (metrics.successfulDeletions / metrics.totalItems) * 100;
    const currentSuccessRate = this.getMetric('success_rate', 0);
    const newSuccessRate = ((currentSuccessRate * totalOps) + successRate) / (totalOps + 1);
    this.setMetric('success_rate', newSuccessRate);

    // Update error rate
    const errorRate = (metrics.failedDeletions / metrics.totalItems) * 100;
    const currentErrorRate = this.getMetric('error_rate', 0);
    const newErrorRate = ((currentErrorRate * totalOps) + errorRate) / (totalOps + 1);
    this.setMetric('error_rate', newErrorRate);

    // Update average processing time
    const currentAvgTime = this.getMetric('avg_processing_time', 0);
    const newAvgTime = ((currentAvgTime * totalOps) + metrics.totalExecutionTime) / (totalOps + 1);
    this.setMetric('avg_processing_time', newAvgTime);

    // Update peak memory usage
    const currentPeakMemory = this.getMetric('peak_memory_usage', 0);
    if (metrics.peakMemoryUsage > currentPeakMemory) {
      this.setMetric('peak_memory_usage', metrics.peakMemoryUsage);
    }
  }

  /**
   * Get performance metrics for a specific operation
   */
  public getBatchMetrics(operationId: string): BatchPerformanceMetrics | null {
    return this.metrics.get(`batch_${operationId}`) || null;
  }

  /**
   * Get aggregated performance metrics
   */
  public getAggregatedMetrics(): Record<string, any> {
    return {
      totalOperations: this.getMetric('total_operations', 0),
      successRate: this.getMetric('success_rate', 0),
      errorRate: this.getMetric('error_rate', 0),
      avgProcessingTime: this.getMetric('avg_processing_time', 0),
      peakMemoryUsage: this.getMetric('peak_memory_usage', 0),
      activeBatches: this.getMetric('active_batches', 0),
      databaseConnections: this.getMetric('database_connections', 0)
    };
  }

  /**
   * Get resource usage history
   */
  public getResourceUsageHistory(limit?: number): ResourceUsage[] {
    if (limit) {
      return this.resourceUsageHistory.slice(-limit);
    }
    return [...this.resourceUsageHistory];
  }

  /**
   * Get resource usage trend
   */
  public getResourceUsageTrend(metric: keyof ResourceUsage, minutes: number = 5): {
    trend: 'increasing' | 'decreasing' | 'stable';
    change: number;
    values: number[];
  } {
    const cutoffTime = Date.now() - (minutes * 60 * 1000);
    const recentUsage = this.resourceUsageHistory.filter(
      usage => usage.timestamp >= cutoffTime
    );

    if (recentUsage.length < 2) {
      return {
        trend: 'stable',
        change: 0,
        values: []
      };
    }

    const values = recentUsage.map(usage => usage[metric] as number);
    const first = values[0];
    const last = values[values.length - 1];
    const change = ((last - first) / first) * 100;

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (Math.abs(change) > 5) {
      trend = change > 0 ? 'increasing' : 'decreasing';
    }

    return {
      trend,
      change,
      values
    };
  }

  /**
   * Set a metric value
   */
  public setMetric(key: string, value: any): void {
    this.metrics.set(key, value);
  }

  /**
   * Get a metric value
   */
  public getMetric(key: string, defaultValue?: any): any {
    return this.metrics.get(key) ?? defaultValue;
  }

  /**
   * Increment a metric value
   */
  public incrementMetric(key: string, increment: number = 1): void {
    const current = this.getMetric(key, 0);
    this.setMetric(key, current + increment);
  }

  /**
   * Decrement a metric value
   */
  public decrementMetric(key: string, decrement: number = 1): void {
    const current = this.getMetric(key, 0);
    this.setMetric(key, Math.max(0, current - decrement));
  }

  /**
   * Clear all metrics
   */
  public clearMetrics(): void {
    this.metrics.clear();
    this.resourceUsageHistory = [];
    logger.info('Performance metrics cleared');
  }

  /**
   * Export metrics for external monitoring systems
   */
  public exportMetrics(format: 'json' | 'prometheus' | 'csv' = 'json'): string {
    const metrics = this.getAggregatedMetrics();
    const resourceUsage = this.getCurrentResourceUsage();

    const data = {
      ...metrics,
      ...resourceUsage,
      timestamp: Date.now()
    };

    switch (format) {
      case 'prometheus':
        return this.formatPrometheusMetrics(data);
      case 'csv':
        return this.formatCsvMetrics(data);
      case 'json':
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  /**
   * Format metrics for Prometheus
   */
  private formatPrometheusMetrics(data: Record<string, any>): string {
    const lines: string[] = [];
    
    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === 'number') {
        lines.push(`moon_lib_${key} ${value}`);
      }
    });

    return lines.join('\n');
  }

  /**
   * Format metrics for CSV
   */
  private formatCsvMetrics(data: Record<string, any>): string {
    const headers = Object.keys(data);
    const values = Object.values(data);
    
    return [
      headers.join(','),
      values.join(',')
    ].join('\n');
  }

  /**
   * Create a performance snapshot
   */
  public createSnapshot(): {
    metrics: Record<string, any>;
    resourceUsage: ResourceUsage;
    timestamp: number;
  } {
    return {
      metrics: this.getAggregatedMetrics(),
      resourceUsage: this.getCurrentResourceUsage(),
      timestamp: Date.now()
    };
  }

  /**
   * Compare two performance snapshots
   */
  public compareSnapshots(
    snapshot1: ReturnType<typeof this.createSnapshot>,
    snapshot2: ReturnType<typeof this.createSnapshot>
  ): {
    metrics: Record<string, { before: any; after: any; change: number | null }>;
    resourceUsage: Record<string, { before: any; after: any; change: number | null }>;
    timeDiff: number;
  } {
    const metricsComparison: Record<string, any> = {};
    const resourceUsageComparison: Record<string, any> = {};

    // Compare metrics
    Object.keys(snapshot1.metrics).forEach(key => {
      const before = snapshot1.metrics[key];
      const after = snapshot2.metrics[key];
      let change: number | null = null;

      if (typeof before === 'number' && typeof after === 'number') {
        change = after - before;
      }

      metricsComparison[key] = { before, after, change };
    });

    // Compare resource usage
    Object.keys(snapshot1.resourceUsage).forEach(key => {
      const before = (snapshot1.resourceUsage as any)[key];
      const after = (snapshot2.resourceUsage as any)[key];
      let change: number | null = null;

      if (typeof before === 'number' && typeof after === 'number') {
        change = after - before;
      }

      resourceUsageComparison[key] = { before, after, change };
    });

    return {
      metrics: metricsComparison,
      resourceUsage: resourceUsageComparison,
      timeDiff: snapshot2.timestamp - snapshot1.timestamp
    };
  }
}

/**
 * Performance timer utility for measuring execution time
 */
export class PerformanceTimer {
  private startTime: number;
  private endTime: number | null = null;
  private name: string;

  constructor(name: string) {
    this.name = name;
    this.startTime = Date.now();
  }

  /**
   * Stop the timer and return elapsed time
   */
  public stop(): number {
    this.endTime = Date.now();
    const elapsed = this.endTime - this.startTime;
    
    logger.debug(`Performance timer: ${this.name}`, {
      executionTime: elapsed,
      startTime: this.startTime,
      endTime: this.endTime
    });

    return elapsed;
  }

  /**
   * Get elapsed time without stopping the timer
   */
  public getElapsed(): number {
    const currentTime = this.endTime || Date.now();
    return currentTime - this.startTime;
  }

  /**
   * Reset the timer
   */
  public reset(): void {
    this.startTime = Date.now();
    this.endTime = null;
  }
}

/**
 * Memory usage tracker
 */
export class MemoryTracker {
  private snapshots: Array<{
    timestamp: number;
    usage: NodeJS.MemoryUsage;
    label?: string;
  }> = [];

  /**
   * Take a memory snapshot
   */
  public takeSnapshot(label?: string): void {
    this.snapshots.push({
      timestamp: Date.now(),
      usage: process.memoryUsage(),
      label
    });

    // Keep only last 100 snapshots
    if (this.snapshots.length > 100) {
      this.snapshots.shift();
    }
  }

  /**
   * Get memory usage trend
   */
  public getTrend(): {
    trend: 'increasing' | 'decreasing' | 'stable';
    change: number;
    snapshots: Array<{ memoryUsage: number; timestamp: number }>;
  } {
    if (this.snapshots.length < 2) {
      return {
        trend: 'stable',
        change: 0,
        snapshots: this.snapshots.map(s => ({
          memoryUsage: s.usage.heapUsed,
          timestamp: s.timestamp
        }))
      };
    }

    const first = this.snapshots[0].usage.heapUsed;
    const last = this.snapshots[this.snapshots.length - 1].usage.heapUsed;
    const change = ((last - first) / first) * 100;

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (Math.abs(change) > 5) {
      trend = change > 0 ? 'increasing' : 'decreasing';
    }

    return {
      trend,
      change,
      snapshots: this.snapshots.map(s => ({
        memoryUsage: s.usage.heapUsed,
        timestamp: s.timestamp
      }))
    };
  }

  /**
   * Get current memory usage in MB
   */
  public getCurrentUsage(): {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  } {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
      rss: Math.round(usage.rss / 1024 / 1024)
    };
  }

  /**
   * Clear all snapshots
   */
  public clear(): void {
    this.snapshots = [];
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();