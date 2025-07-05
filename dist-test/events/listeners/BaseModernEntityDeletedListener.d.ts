import { RetryableListener, EntityDeletedEvent, Subjects } from '../..';
import { Stan } from 'node-nats-streaming';
import mongoose from 'mongoose';
/**
 * Performance metrics interface
 */
interface PerformanceMetrics {
    timestamp: Date;
    serviceName: string;
    entitiesCount: number;
    totalDurationMs: number;
    validationDurationMs: number;
    authDurationMs: number;
    processingDurationMs: number;
    successfulDeletions: number;
    failedDeletions: number;
    entitiesPerSecond: number;
    memoryUsage: {
        heapUsed: number;
        heapTotal: number;
        external: number;
    };
}
/**
 * Abstract base class for Modern EntityDeleted Listeners
 *
 * This abstract class provides common functionality for all modern entity deletion listeners
 * including strategy pattern implementation, resilience features, and standardized error handling.
 *
 * Features:
 * - Dynamic strategy resolution with resilience
 * - Automatic fallback to legacy implementation
 * - Comprehensive error handling and logging
 * - OpenTracing integration
 * - Cross-service deletion support
 * - Strategy initialization status monitoring
 */
export declare abstract class BaseModernEntityDeletedListener extends RetryableListener<EntityDeletedEvent> {
    subject: Subjects.EntityDeleted;
    /**
     * Service name for this listener - must be implemented by subclasses
     */
    protected abstract readonly serviceName: string;
    /**
     * Queue group name - must be provided by subclasses
     */
    abstract readonly queueGroupName: string;
    /**
     * Tracer instance - must be provided by subclasses
     */
    protected abstract readonly tracer: any;
    constructor(client: Stan, options?: any, connection?: mongoose.Connection);
    /**
     * Generate unique event ID for tracking
     */
    getEventId(data: EntityDeletedEvent['data']): string;
    /**
     * Process entity deletion events using strategy pattern with fallback
     */
    processEvent(data: EntityDeletedEvent['data']): Promise<void>;
    /**
     * Process individual entity deletion with strategy pattern and fallback
     */
    private processEntityDeletion;
    /**
     * Determine if transactions should be used based on configuration
     */
    protected shouldUseTransactions(): boolean;
    /**
     * Get health status for this listener
     */
    getHealthStatus(): {
        strategiesRegistered: number;
        transactionSupported: boolean;
        fallbackAvailable: boolean;
        supportedEntities: string[];
    };
    /**
     * Get strategy information for a specific entity type
     */
    getStrategyInfo(entityType: string): {
        hasStrategy: boolean;
        strategy?: {
            name: string;
            serviceName: string;
            priority: number;
            ownership?: string;
            deletionType?: string;
        };
    };
    /**
     * Get comprehensive resilience status including initialization information
     */
    getResilienceStatus(): {
        initializationStatus: {
            totalErrors: number;
            errorsByEntity: Record<string, string>;
            retryAttempts: Record<string, number>;
        };
        strategiesHealth: {
            totalStrategies: number;
            entitiesSupported: string[];
            servicesInvolved: string[];
        };
        transactionSupport: boolean;
    };
    /**
     * Validate and sanitize input data
     */
    private validateAndSanitizeInput;
    /**
     * Perform authorization checks
     */
    private performAuthorizationChecks;
    /**
     * Service-specific authorization - can be overridden by subclasses
     */
    protected performServiceSpecificAuthorization(data: EntityDeletedEvent['data'], userId: string, span?: any): Promise<void>;
    /**
     * Rate limiting cache (in-memory implementation)
     */
    private rateLimitCache?;
    /**
     * Performance metrics cache
     */
    private performanceMetrics;
    private readonly MAX_METRICS_HISTORY;
    /**
     * Record performance metrics for monitoring
     */
    private recordPerformanceMetrics;
    /**
     * Check performance thresholds and log warnings
     */
    private checkPerformanceThresholds;
    /**
     * Get current memory usage
     */
    private getMemoryUsage;
    /**
     * Get performance statistics
     */
    getPerformanceStats(): {
        totalEvents: number;
        averageDurationMs: number;
        averageEntitiesPerSecond: number;
        slowestEventMs: number;
        fastestEventMs: number;
        totalEntitiesProcessed: number;
        successRate: number;
        memoryUsage: {
            heapUsed: number;
            heapTotal: number;
            external: number;
        };
        recentEvents: PerformanceMetrics[];
    };
    /**
     * Clear performance metrics history
     */
    clearPerformanceHistory(): void;
    /**
     * Generate comprehensive system documentation
     */
    generateSystemDocumentation(): {
        service: {
            name: string;
            description: string;
            features: string[];
        };
        architecture: {
            pattern: string;
            resilience: string[];
            security: string[];
        };
        performance: {
            monitoring: string[];
            thresholds: Record<string, string>;
            metrics: any;
        };
        api: {
            methods: Array<{
                name: string;
                description: string;
                returns: string;
            }>;
        };
        configuration: {
            environmentVariables: string[];
            features: Record<string, boolean>;
        };
    };
    /**
     * Generate API documentation in markdown format
     */
    generateApiDocumentation(): string;
    /**
     * Legacy fallback implementation - must be implemented by subclasses
     * This method should handle entity deletion using the old switch-case pattern
     */
    protected abstract legacyFallback(entity: {
        entity: string;
        entityId: string;
    }, userId: string, span?: any): Promise<void>;
}
export {};
//# sourceMappingURL=BaseModernEntityDeletedListener.d.ts.map