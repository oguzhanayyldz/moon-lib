import { EventEmitter } from 'events';
import { BatchPerformanceMetrics, ResourceUsage, MonitoringConfig } from '../common/interfaces/batch-deletion.interface';
/**
 * Performance monitoring utility for batch operations
 */
export declare class PerformanceMonitor extends EventEmitter {
    private static instance;
    private metrics;
    private resourceUsageHistory;
    private monitoringInterval;
    private config;
    private isMonitoring;
    private constructor();
    /**
     * Get singleton instance
     */
    static getInstance(config?: MonitoringConfig): PerformanceMonitor;
    /**
     * Start monitoring performance metrics
     */
    startMonitoring(): void;
    /**
     * Stop monitoring performance metrics
     */
    stopMonitoring(): void;
    /**
     * Collect current performance metrics
     */
    private collectMetrics;
    /**
     * Get current resource usage
     */
    getCurrentResourceUsage(): ResourceUsage;
    /**
     * Check performance thresholds and emit alerts
     */
    private checkThresholds;
    /**
     * Record batch performance metrics
     */
    recordBatchMetrics(operationId: string, metrics: BatchPerformanceMetrics): void;
    /**
     * Update aggregated metrics
     */
    private updateAggregatedMetrics;
    /**
     * Get performance metrics for a specific operation
     */
    getBatchMetrics(operationId: string): BatchPerformanceMetrics | null;
    /**
     * Get aggregated performance metrics
     */
    getAggregatedMetrics(): Record<string, any>;
    /**
     * Get resource usage history
     */
    getResourceUsageHistory(limit?: number): ResourceUsage[];
    /**
     * Get resource usage trend
     */
    getResourceUsageTrend(metric: keyof ResourceUsage, minutes?: number): {
        trend: 'increasing' | 'decreasing' | 'stable';
        change: number;
        values: number[];
    };
    /**
     * Set a metric value
     */
    setMetric(key: string, value: any): void;
    /**
     * Get a metric value
     */
    getMetric(key: string, defaultValue?: any): any;
    /**
     * Increment a metric value
     */
    incrementMetric(key: string, increment?: number): void;
    /**
     * Decrement a metric value
     */
    decrementMetric(key: string, decrement?: number): void;
    /**
     * Clear all metrics
     */
    clearMetrics(): void;
    /**
     * Export metrics for external monitoring systems
     */
    exportMetrics(format?: 'json' | 'prometheus' | 'csv'): string;
    /**
     * Format metrics for Prometheus
     */
    private formatPrometheusMetrics;
    /**
     * Format metrics for CSV
     */
    private formatCsvMetrics;
    /**
     * Create a performance snapshot
     */
    createSnapshot(): {
        metrics: Record<string, any>;
        resourceUsage: ResourceUsage;
        timestamp: number;
    };
    /**
     * Compare two performance snapshots
     */
    compareSnapshots(snapshot1: ReturnType<typeof this.createSnapshot>, snapshot2: ReturnType<typeof this.createSnapshot>): {
        metrics: Record<string, {
            before: any;
            after: any;
            change: number | null;
        }>;
        resourceUsage: Record<string, {
            before: any;
            after: any;
            change: number | null;
        }>;
        timeDiff: number;
    };
}
/**
 * Performance timer utility for measuring execution time
 */
export declare class PerformanceTimer {
    private startTime;
    private endTime;
    private name;
    constructor(name: string);
    /**
     * Stop the timer and return elapsed time
     */
    stop(): number;
    /**
     * Get elapsed time without stopping the timer
     */
    getElapsed(): number;
    /**
     * Reset the timer
     */
    reset(): void;
}
/**
 * Memory usage tracker
 */
export declare class MemoryTracker {
    private snapshots;
    /**
     * Take a memory snapshot
     */
    takeSnapshot(label?: string): void;
    /**
     * Get memory usage trend
     */
    getTrend(): {
        trend: 'increasing' | 'decreasing' | 'stable';
        change: number;
        snapshots: Array<{
            memoryUsage: number;
            timestamp: number;
        }>;
    };
    /**
     * Get current memory usage in MB
     */
    getCurrentUsage(): {
        heapUsed: number;
        heapTotal: number;
        external: number;
        rss: number;
    };
    /**
     * Clear all snapshots
     */
    clear(): void;
}
export declare const performanceMonitor: PerformanceMonitor;
