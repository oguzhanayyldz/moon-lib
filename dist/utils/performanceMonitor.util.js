"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.performanceMonitor = exports.MemoryTracker = exports.PerformanceTimer = exports.PerformanceMonitor = void 0;
const events_1 = require("events");
const logger_service_1 = require("../services/logger.service");
/**
 * Performance monitoring utility for batch operations
 */
class PerformanceMonitor extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.metrics = new Map();
        this.resourceUsageHistory = [];
        this.monitoringInterval = null;
        this.isMonitoring = false;
        this.config = config;
    }
    /**
     * Get singleton instance
     */
    static getInstance(config) {
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
    startMonitoring() {
        if (!this.config.enabled || this.isMonitoring) {
            return;
        }
        this.isMonitoring = true;
        this.monitoringInterval = setInterval(() => {
            this.collectMetrics();
        }, this.config.metricsInterval);
        logger_service_1.logger.info('Performance monitoring started', {
            interval: this.config.metricsInterval,
            thresholds: this.config.alertThresholds
        });
    }
    /**
     * Stop monitoring performance metrics
     */
    stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.isMonitoring = false;
        logger_service_1.logger.info('Performance monitoring stopped');
    }
    /**
     * Collect current performance metrics
     */
    collectMetrics() {
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
    getCurrentResourceUsage() {
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
    checkThresholds(resourceUsage) {
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
    recordBatchMetrics(operationId, metrics) {
        const timestamp = Date.now();
        this.metrics.set(`batch_${operationId}`, Object.assign(Object.assign({}, metrics), { timestamp }));
        // Update aggregated metrics
        this.updateAggregatedMetrics(metrics);
        // Emit metrics event
        this.emit('batch-metrics-recorded', {
            operationId,
            metrics,
            timestamp
        });
        logger_service_1.logger.debug('Batch metrics recorded', {
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
    updateAggregatedMetrics(metrics) {
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
    getBatchMetrics(operationId) {
        return this.metrics.get(`batch_${operationId}`) || null;
    }
    /**
     * Get aggregated performance metrics
     */
    getAggregatedMetrics() {
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
    getResourceUsageHistory(limit) {
        if (limit) {
            return this.resourceUsageHistory.slice(-limit);
        }
        return [...this.resourceUsageHistory];
    }
    /**
     * Get resource usage trend
     */
    getResourceUsageTrend(metric, minutes = 5) {
        const cutoffTime = Date.now() - (minutes * 60 * 1000);
        const recentUsage = this.resourceUsageHistory.filter(usage => usage.timestamp >= cutoffTime);
        if (recentUsage.length < 2) {
            return {
                trend: 'stable',
                change: 0,
                values: []
            };
        }
        const values = recentUsage.map(usage => usage[metric]);
        const first = values[0];
        const last = values[values.length - 1];
        const change = ((last - first) / first) * 100;
        let trend = 'stable';
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
    setMetric(key, value) {
        this.metrics.set(key, value);
    }
    /**
     * Get a metric value
     */
    getMetric(key, defaultValue) {
        var _a;
        return (_a = this.metrics.get(key)) !== null && _a !== void 0 ? _a : defaultValue;
    }
    /**
     * Increment a metric value
     */
    incrementMetric(key, increment = 1) {
        const current = this.getMetric(key, 0);
        this.setMetric(key, current + increment);
    }
    /**
     * Decrement a metric value
     */
    decrementMetric(key, decrement = 1) {
        const current = this.getMetric(key, 0);
        this.setMetric(key, Math.max(0, current - decrement));
    }
    /**
     * Clear all metrics
     */
    clearMetrics() {
        this.metrics.clear();
        this.resourceUsageHistory = [];
        logger_service_1.logger.info('Performance metrics cleared');
    }
    /**
     * Export metrics for external monitoring systems
     */
    exportMetrics(format = 'json') {
        const metrics = this.getAggregatedMetrics();
        const resourceUsage = this.getCurrentResourceUsage();
        const data = Object.assign(Object.assign(Object.assign({}, metrics), resourceUsage), { timestamp: Date.now() });
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
    formatPrometheusMetrics(data) {
        const lines = [];
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
    formatCsvMetrics(data) {
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
    createSnapshot() {
        return {
            metrics: this.getAggregatedMetrics(),
            resourceUsage: this.getCurrentResourceUsage(),
            timestamp: Date.now()
        };
    }
    /**
     * Compare two performance snapshots
     */
    compareSnapshots(snapshot1, snapshot2) {
        const metricsComparison = {};
        const resourceUsageComparison = {};
        // Compare metrics
        Object.keys(snapshot1.metrics).forEach(key => {
            const before = snapshot1.metrics[key];
            const after = snapshot2.metrics[key];
            let change = null;
            if (typeof before === 'number' && typeof after === 'number') {
                change = after - before;
            }
            metricsComparison[key] = { before, after, change };
        });
        // Compare resource usage
        Object.keys(snapshot1.resourceUsage).forEach(key => {
            const before = snapshot1.resourceUsage[key];
            const after = snapshot2.resourceUsage[key];
            let change = null;
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
exports.PerformanceMonitor = PerformanceMonitor;
/**
 * Performance timer utility for measuring execution time
 */
class PerformanceTimer {
    constructor(name) {
        this.endTime = null;
        this.name = name;
        this.startTime = Date.now();
    }
    /**
     * Stop the timer and return elapsed time
     */
    stop() {
        this.endTime = Date.now();
        const elapsed = this.endTime - this.startTime;
        logger_service_1.logger.debug(`Performance timer: ${this.name}`, {
            executionTime: elapsed,
            startTime: this.startTime,
            endTime: this.endTime
        });
        return elapsed;
    }
    /**
     * Get elapsed time without stopping the timer
     */
    getElapsed() {
        const currentTime = this.endTime || Date.now();
        return currentTime - this.startTime;
    }
    /**
     * Reset the timer
     */
    reset() {
        this.startTime = Date.now();
        this.endTime = null;
    }
}
exports.PerformanceTimer = PerformanceTimer;
/**
 * Memory usage tracker
 */
class MemoryTracker {
    constructor() {
        this.snapshots = [];
    }
    /**
     * Take a memory snapshot
     */
    takeSnapshot(label) {
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
    getTrend() {
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
        let trend = 'stable';
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
    getCurrentUsage() {
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
    clear() {
        this.snapshots = [];
    }
}
exports.MemoryTracker = MemoryTracker;
// Export singleton instance
exports.performanceMonitor = PerformanceMonitor.getInstance();
