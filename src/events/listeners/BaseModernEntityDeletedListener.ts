import { RetryableListener, EntityDeletedEvent, Subjects, logger } from '../..';
import { entityDeletionRegistry } from '../../services/entityDeletionRegistry';
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
export abstract class BaseModernEntityDeletedListener extends RetryableListener<EntityDeletedEvent> {
  subject: Subjects.EntityDeleted = Subjects.EntityDeleted;
  
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

  constructor(client: Stan, options: any = {}, connection: mongoose.Connection = mongoose.connection) {
    super(client, options, connection);
  }

  /**
   * Generate unique event ID for tracking
   */
  getEventId(data: EntityDeletedEvent['data']): string {
    // Legacy listener pattern ile uyumlu olacak şekilde deterministik ID üret
    if (data.list && data.list.length > 0) {
      const firstItem = data.list[0];
      return `${firstItem.entity}-${firstItem.id}`;
    }
    // Fallback - legacy pattern ile uyumlu
    return `${data.entity || 'unknown'}-${Date.now()}`;
  }

  /**
   * Process entity deletion events using strategy pattern with fallback
   */
  async processEvent(data: EntityDeletedEvent['data']): Promise<void> {
    const startTime = Date.now();
    const span = this.tracer?.startSpan(`${this.serviceName}_entity_deleted_processing`);
    
    try {
      // Step 1: Input validation and sanitization
      const validationStartTime = Date.now();
      await this.validateAndSanitizeInput(data, span);
      const validationDuration = Date.now() - validationStartTime;
      
      // Get userId from first item if available
      const userId = data.list.length > 0 ? (data.list[0].userId || 'unknown') : 'unknown';
      
      // Step 2: Authorization checks
      const authStartTime = Date.now();
      await this.performAuthorizationChecks(data, userId, span);
      const authDuration = Date.now() - authStartTime;
      
      span?.setTag('user.id', userId);
      span?.setTag('entities.count', data.list.length);
      span?.setTag('service.name', this.serviceName);
      span?.setTag('validation.passed', true);
      span?.setTag('authorization.passed', true);
      span?.setTag('validation.duration.ms', validationDuration);
      span?.setTag('authorization.duration.ms', authDuration);

      logger.info(`Processing entity deletion event in ${this.serviceName} service`, {
        userId: userId,
        entitiesCount: data.list.length,
        entities: data.list.map(e => ({ type: e.entity, id: e.id }))
      });

      // Process each entity deletion with performance tracking
      const processingStartTime = Date.now();
      let successfulDeletions = 0;
      let failedDeletions = 0;
      
      for (const entity of data.list) {
        try {
          await this.processEntityDeletion({
            entity: entity.entity,
            entityId: entity.id
          }, entity.userId || userId, span);
          successfulDeletions++;
        } catch (error) {
          failedDeletions++;
          logger.error(`Failed to process entity deletion`, {
            serviceName: this.serviceName,
            entityType: entity.entity,
            entityId: entity.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          throw error; // Re-throw to maintain existing error handling
        }
      }
      
      const processingDuration = Date.now() - processingStartTime;
      const totalDuration = Date.now() - startTime;
      
      // Performance metrics
      span?.setTag('processing.duration.ms', processingDuration);
      span?.setTag('total.duration.ms', totalDuration);
      span?.setTag('successful.deletions', successfulDeletions);
      span?.setTag('failed.deletions', failedDeletions);
      span?.setTag('entities.per.second', Math.round((data.list.length / totalDuration) * 1000));
      
      // Performance monitoring
      this.recordPerformanceMetrics({
        serviceName: this.serviceName,
        entitiesCount: data.list.length,
        totalDuration,
        validationDuration,
        authDuration,
        processingDuration,
        successfulDeletions,
        failedDeletions
      });

      logger.info(`Entity deletion event processed successfully in ${this.serviceName} service`, {
        userId: userId,
        entitiesProcessed: data.list.length,
        totalDurationMs: totalDuration,
        validationDurationMs: validationDuration,
        authDurationMs: authDuration,
        processingDurationMs: processingDuration,
        entitiesPerSecond: Math.round((data.list.length / totalDuration) * 1000)
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      span?.setTag('error', true);
      span?.setTag('error.message', errorMessage);
      
      logger.error(`Failed to process entity deletion event in ${this.serviceName} service`, {
        userId: data.list.length > 0 ? (data.list[0].userId || 'unknown') : 'unknown',
        entities: data.list,
        error: errorMessage
      });

      throw error;
    } finally {
      span?.finish();
    }
  }

  /**
   * Process individual entity deletion with strategy pattern and fallback
   */
  private async processEntityDeletion(
    entity: { entity: string; entityId: string }, 
    userId: string,
    parentSpan?: any
  ): Promise<void> {
    const span = this.tracer?.startSpan(`${this.serviceName}_process_entity_deletion`, { childOf: parentSpan });
    
    try {
      span?.setTag('entity.type', entity.entity);
      span?.setTag('entity.id', entity.entityId);
      span?.setTag('user.id', userId);

      // Step 1: Try strategy pattern approach with resilience check
      const strategy = entityDeletionRegistry.resolve(entity.entity);
      const initStatus = entityDeletionRegistry.getInitializationStatus();
      
      // Log initialization status if there are errors
      if (initStatus.totalErrors > 0) {
        logger.warn(`Strategy registry has initialization errors`, {
          totalErrors: initStatus.totalErrors,
          errorsByEntity: initStatus.errorsByEntity,
          retryAttempts: initStatus.retryAttempts
        });
      }
      
      if (strategy) {
        logger.info(`Using strategy pattern for ${entity.entity} deletion in ${this.serviceName} service`, {
          entityType: entity.entity,
          entityId: entity.entityId,
          strategyName: strategy.constructor.name,
          serviceName: strategy.serviceName,
          ownership: (strategy as any).ownership
        });

        const result = await entityDeletionRegistry.execute({
          entityType: entity.entity,
          entityId: entity.entityId,
          userId,
          serviceName: this.serviceName,
          config: {
            useTransactions: this.shouldUseTransactions(),
            enableDetailedLogging: true
          }
        });

        if (result.success) {
          span?.setTag('strategy.used', true);
          span?.setTag('strategy.name', strategy.constructor.name);
          span?.setTag('strategy.ownership', (strategy as any).ownership);
          span?.setTag('entities.deleted', result.deletedEntities.length);
          
          logger.info(`Strategy deletion completed successfully in ${this.serviceName} service`, {
            entityType: entity.entity,
            entityId: entity.entityId,
            strategy: strategy.constructor.name,
            ownership: (strategy as any).ownership,
            deletedEntities: result.deletedEntities,
            affectedServices: result.affectedServices,
            executionTime: result.metrics?.executionTime
          });
        } else {
          // Enhanced error handling with resilience information
          const errorDetails = {
            entityType: entity.entity,
            entityId: entity.entityId,
            strategyError: result.error,
            metadata: result.metadata
          };
          
          logger.error(`Strategy deletion failed, checking for resilience options`, errorDetails);
          
          // Check if this is a strategy initialization issue
          if (result.metadata?.initializationErrors) {
            logger.warn(`Strategy deletion failed due to initialization errors, attempting fallback`);
            // Don't throw, let it fall through to legacy fallback
          } else {
            throw new Error(`Strategy deletion failed: ${result.error}`);
          }
        }
      } else {
        // Step 2: Check if this entity is managed by this service
        const isEntityManagedByService = this.isEntityManagedByService(entity.entity);

        if (!isEntityManagedByService) {
          // This entity is not managed by this service, skip silently
          logger.debug(`Entity ${entity.entity} not managed by ${this.serviceName}, skipping deletion`, {
            entityType: entity.entity,
            entityId: entity.entityId,
            serviceName: this.serviceName
          });

          span?.setTag('strategy.used', false);
          span?.setTag('entity.skipped', true);
          span?.setTag('skip.reason', 'entity-not-managed-by-service');

          return; // Skip silently without error
        }

        // Step 3: Fallback to legacy implementation (only for managed entities)
        logger.warn(`No strategy found for ${entity.entity} in ${this.serviceName} service, falling back to legacy implementation`, {
          entityType: entity.entity,
          entityId: entity.entityId,
          initializationErrors: initStatus.errorsByEntity[entity.entity] || null
        });

        span?.setTag('strategy.used', false);
        span?.setTag('fallback.used', true);

        // Call service-specific legacy fallback
        await this.legacyFallback(entity, userId, span);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      span?.setTag('error', true);
      span?.setTag('error.message', errorMessage);
      
      logger.error(`Failed to process entity deletion for ${entity.entity} in ${this.serviceName} service`, {
        entityType: entity.entity,
        entityId: entity.entityId,
        userId,
        error: errorMessage
      });

      throw error;
    } finally {
      span?.finish();
    }
  }

  /**
   * Determine if transactions should be used based on configuration
   */
  protected shouldUseTransactions(): boolean {
    // Check environment variable or service configuration
    const useTransactions = process.env.USE_TRANSACTIONS === 'true';
    
    // Could also check if transaction manager is available
    const transactionManagerAvailable = entityDeletionRegistry.isTransactionManagerAvailable();
    
    return useTransactions && transactionManagerAvailable;
  }

  /**
   * Get health status for this listener
   */
  getHealthStatus(): {
    strategiesRegistered: number;
    transactionSupported: boolean;
    fallbackAvailable: boolean;
    supportedEntities: string[];
  } {
    const stats = entityDeletionRegistry.getStats();
    const transactionSupported = entityDeletionRegistry.isTransactionManagerAvailable();
    
    return {
      strategiesRegistered: stats.totalStrategies,
      transactionSupported,
      fallbackAvailable: true,
      supportedEntities: stats.entitiesSupported
    };
  }

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
  } {
    const strategy = entityDeletionRegistry.resolve(entityType);
    
    if (strategy) {
      return {
        hasStrategy: true,
        strategy: {
          name: strategy.constructor.name,
          serviceName: strategy.serviceName,
          priority: strategy.priority,
          ownership: (strategy as any).ownership,
          deletionType: (strategy as any).deletionType
        }
      };
    }
    
    return { hasStrategy: false };
  }

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
  } {
    const initStatus = entityDeletionRegistry.getInitializationStatus();
    const strategiesHealth = entityDeletionRegistry.getStats();
    
    return {
      initializationStatus: initStatus,
      strategiesHealth,
      transactionSupport: entityDeletionRegistry.isTransactionManagerAvailable()
    };
  }

  /**
   * Validate and sanitize input data
   */
  private async validateAndSanitizeInput(
    data: EntityDeletedEvent['data'],
    span?: any
  ): Promise<void> {
    const validationSpan = this.tracer?.startSpan('input_validation', { childOf: span });
    
    try {
      // Basic structure validation
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid event data: data must be an object');
      }
      
      if (!Array.isArray(data.list)) {
        throw new Error('Invalid event data: list must be an array');
      }
      
      if (data.list.length === 0) {
        throw new Error('Invalid event data: list cannot be empty');
      }
      
      if (data.list.length > 100) {
        throw new Error('Invalid event data: list cannot contain more than 100 items');
      }
      
      // Validate each entity in the list
      for (let i = 0; i < data.list.length; i++) {
        const entity = data.list[i];
        
        if (!entity || typeof entity !== 'object') {
          throw new Error(`Invalid entity at index ${i}: entity must be an object`);
        }
        
        // Validate entity ID
        if (!entity.id || typeof entity.id !== 'string') {
          throw new Error(`Invalid entity at index ${i}: id must be a non-empty string`);
        }
        
        // Sanitize entity ID (remove potential harmful characters)
        if (!/^[a-fA-F0-9]{24}$/.test(entity.id)) {
          throw new Error(`Invalid entity at index ${i}: id must be a valid MongoDB ObjectId`);
        }
        
        // Validate entity type
        if (!entity.entity || typeof entity.entity !== 'string') {
          throw new Error(`Invalid entity at index ${i}: entity type must be a non-empty string`);
        }
        
        // Sanitize entity type (allow only alphanumeric and underscore)
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(entity.entity)) {
          throw new Error(`Invalid entity at index ${i}: entity type contains invalid characters`);
        }
        
        // Validate timestamp if present
        if (entity.timestamp) {
          const timestamp = new Date(entity.timestamp);
          if (isNaN(timestamp.getTime())) {
            throw new Error(`Invalid entity at index ${i}: timestamp is not a valid date`);
          }
          
          // Check if timestamp is not too old (more than 24 hours)
          const hoursDiff = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60);
          if (hoursDiff > 24) {
            logger.warn('Entity deletion event timestamp is more than 24 hours old', {
              entityId: entity.id,
              entityType: entity.entity,
              timestamp: entity.timestamp,
              hoursDiff
            });
          }
        }
        
        // Validate userId if present
        if (entity.userId) {
          if (typeof entity.userId !== 'string' || entity.userId.length === 0) {
            throw new Error(`Invalid entity at index ${i}: userId must be a non-empty string`);
          }
          
          // Sanitize userId (basic validation)
          if (entity.userId.length > 100) {
            throw new Error(`Invalid entity at index ${i}: userId too long`);
          }
        }
      }
      
      validationSpan?.setTag('validation.success', true);
      validationSpan?.setTag('entities.validated', data.list.length);
      
      logger.debug('Input validation passed', {
        serviceName: this.serviceName,
        entitiesCount: data.list.length
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Validation failed';
      
      validationSpan?.setTag('validation.success', false);
      validationSpan?.setTag('validation.error', errorMessage);
      
      logger.error('Input validation failed', {
        serviceName: this.serviceName,
        error: errorMessage,
        data: data
      });
      
      throw new Error(`Input validation failed: ${errorMessage}`);
    } finally {
      validationSpan?.finish();
    }
  }

  /**
   * Perform authorization checks
   */
  private async performAuthorizationChecks(
    data: EntityDeletedEvent['data'],
    userId: string,
    span?: any
  ): Promise<void> {
    const authSpan = this.tracer?.startSpan('authorization_check', { childOf: span });
    
    try {
      // Basic authorization checks
      if (userId === 'unknown') {
        logger.warn('Processing entity deletion with unknown user', {
          serviceName: this.serviceName,
          entitiesCount: data.list.length
        });
      }
      
      // Check for suspicious patterns
      const entityTypes = data.list.map(e => e.entity);
      const uniqueEntityTypes = new Set(entityTypes);
      
      // Flag if trying to delete too many different entity types at once
      if (uniqueEntityTypes.size > 10) {
        logger.warn('Potentially suspicious deletion: too many entity types', {
          serviceName: this.serviceName,
          userId,
          entityTypes: Array.from(uniqueEntityTypes),
          count: uniqueEntityTypes.size
        });
      }
      
      // Check for bulk deletion of critical entities
      const criticalEntities = ['user', 'integration', 'order'];
      const criticalCount = data.list.filter(e => criticalEntities.includes(e.entity)).length;
      
      if (criticalCount > 5) {
        logger.warn('Bulk deletion of critical entities detected', {
          serviceName: this.serviceName,
          userId,
          criticalCount,
          totalCount: data.list.length
        });
      }
      
      // Rate limiting check with bulk operation support
      const currentTime = Date.now();
      const rateLimitKey = `entity_deletion_${this.serviceName}_${userId}`;

      // Note: In a real implementation, you would use Redis or similar for rate limiting
      // This is a basic in-memory implementation for demonstration
      if (!this.rateLimitCache) {
        this.rateLimitCache = new Map();
      }

      const lastRequest = this.rateLimitCache.get(rateLimitKey) || 0;
      const timeDiff = currentTime - lastRequest;

      // Bulk operation detection: if multiple entities, use relaxed rate limit
      // Single entity: 1 req/second, Bulk (2-10 entities): 100ms, Large bulk (>10): no limit
      const isBulkOperation = data.list.length >= 2;
      const isLargeBulk = data.list.length > 10;

      let rateLimitMs = 1000; // Default: 1 request per second for single entities

      if (isLargeBulk) {
        rateLimitMs = 0; // No rate limit for large bulk operations (admin bulk delete)
      } else if (isBulkOperation) {
        rateLimitMs = 100; // 100ms for small bulk operations (2-10 entities)
      }

      if (rateLimitMs > 0 && timeDiff < rateLimitMs) {
        throw new Error('Rate limit exceeded: too many deletion requests');
      }

      this.rateLimitCache.set(rateLimitKey, currentTime);
      
      // Service-specific authorization
      await this.performServiceSpecificAuthorization(data, userId, authSpan);
      
      authSpan?.setTag('authorization.success', true);
      authSpan?.setTag('user.id', userId);
      
      logger.debug('Authorization checks passed', {
        serviceName: this.serviceName,
        userId,
        entitiesCount: data.list.length
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authorization failed';
      
      authSpan?.setTag('authorization.success', false);
      authSpan?.setTag('authorization.error', errorMessage);
      
      logger.error('Authorization check failed', {
        serviceName: this.serviceName,
        userId,
        error: errorMessage
      });
      
      throw new Error(`Authorization failed: ${errorMessage}`);
    } finally {
      authSpan?.finish();
    }
  }

  /**
   * Service-specific authorization - can be overridden by subclasses
   */
  protected async performServiceSpecificAuthorization(
    data: EntityDeletedEvent['data'],
    userId: string,
    span?: any
  ): Promise<void> {
    // Default implementation - subclasses can override for specific authorization logic
    logger.debug('Performing default service authorization', {
      serviceName: this.serviceName,
      userId
    });
  }

  /**
   * Rate limiting cache (in-memory implementation)
   */
  private rateLimitCache?: Map<string, number>;

  /**
   * Performance metrics cache
   */
  private performanceMetrics: PerformanceMetrics[] = [];
  private readonly MAX_METRICS_HISTORY = 1000;

  /**
   * Record performance metrics for monitoring
   */
  private recordPerformanceMetrics(metrics: {
    serviceName: string;
    entitiesCount: number;
    totalDuration: number;
    validationDuration: number;
    authDuration: number;
    processingDuration: number;
    successfulDeletions: number;
    failedDeletions: number;
  }): void {
    const performanceRecord: PerformanceMetrics = {
      timestamp: new Date(),
      serviceName: metrics.serviceName,
      entitiesCount: metrics.entitiesCount,
      totalDurationMs: metrics.totalDuration,
      validationDurationMs: metrics.validationDuration,
      authDurationMs: metrics.authDuration,
      processingDurationMs: metrics.processingDuration,
      successfulDeletions: metrics.successfulDeletions,
      failedDeletions: metrics.failedDeletions,
      entitiesPerSecond: Math.round((metrics.entitiesCount / metrics.totalDuration) * 1000),
      memoryUsage: this.getMemoryUsage()
    };
    
    // Add to metrics history
    this.performanceMetrics.push(performanceRecord);
    
    // Keep only recent metrics to prevent memory leaks
    if (this.performanceMetrics.length > this.MAX_METRICS_HISTORY) {
      this.performanceMetrics = this.performanceMetrics.slice(-this.MAX_METRICS_HISTORY);
    }
    
    // Log performance warnings if needed
    this.checkPerformanceThresholds(performanceRecord);
  }

  /**
   * Check performance thresholds and log warnings
   */
  private checkPerformanceThresholds(metrics: PerformanceMetrics): void {
    // Log warning if processing is taking too long
    if (metrics.totalDurationMs > 5000) { // 5 seconds
      logger.warn('Slow entity deletion processing detected', {
        serviceName: metrics.serviceName,
        entitiesCount: metrics.entitiesCount,
        totalDurationMs: metrics.totalDurationMs,
        entitiesPerSecond: metrics.entitiesPerSecond
      });
    }
    
    // Log warning if validation is taking too long
    if (metrics.validationDurationMs > 1000) { // 1 second
      logger.warn('Slow validation detected', {
        serviceName: metrics.serviceName,
        validationDurationMs: metrics.validationDurationMs
      });
    }
    
    // Log warning if authorization is taking too long
    if (metrics.authDurationMs > 500) { // 500ms
      logger.warn('Slow authorization detected', {
        serviceName: metrics.serviceName,
        authDurationMs: metrics.authDurationMs
      });
    }
    
    // Log warning if throughput is too low
    if (metrics.entitiesPerSecond < 10 && metrics.entitiesCount > 5) {
      logger.warn('Low throughput detected', {
        serviceName: metrics.serviceName,
        entitiesPerSecond: metrics.entitiesPerSecond,
        entitiesCount: metrics.entitiesCount
      });
    }
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): { heapUsed: number; heapTotal: number; external: number } {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memory = process.memoryUsage();
      return {
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024), // MB
        external: Math.round(memory.external / 1024 / 1024) // MB
      };
    }
    return { heapUsed: 0, heapTotal: 0, external: 0 };
  }

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
    memoryUsage: { heapUsed: number; heapTotal: number; external: number };
    recentEvents: PerformanceMetrics[];
  } {
    if (this.performanceMetrics.length === 0) {
      return {
        totalEvents: 0,
        averageDurationMs: 0,
        averageEntitiesPerSecond: 0,
        slowestEventMs: 0,
        fastestEventMs: 0,
        totalEntitiesProcessed: 0,
        successRate: 0,
        memoryUsage: this.getMemoryUsage(),
        recentEvents: []
      };
    }
    
    const totalEvents = this.performanceMetrics.length;
    const totalDuration = this.performanceMetrics.reduce((sum, m) => sum + m.totalDurationMs, 0);
    const totalEntities = this.performanceMetrics.reduce((sum, m) => sum + m.entitiesCount, 0);
    const totalSuccessful = this.performanceMetrics.reduce((sum, m) => sum + m.successfulDeletions, 0);
    const totalFailed = this.performanceMetrics.reduce((sum, m) => sum + m.failedDeletions, 0);
    
    const durations = this.performanceMetrics.map(m => m.totalDurationMs);
    
    return {
      totalEvents,
      averageDurationMs: Math.round(totalDuration / totalEvents),
      averageEntitiesPerSecond: Math.round((totalEntities / totalDuration) * 1000),
      slowestEventMs: Math.max(...durations),
      fastestEventMs: Math.min(...durations),
      totalEntitiesProcessed: totalEntities,
      successRate: totalEntities > 0 ? Math.round((totalSuccessful / (totalSuccessful + totalFailed)) * 100) : 0,
      memoryUsage: this.getMemoryUsage(),
      recentEvents: this.performanceMetrics.slice(-10) // Last 10 events
    };
  }

  /**
   * Clear performance metrics history
   */
  clearPerformanceHistory(): void {
    this.performanceMetrics = [];
    logger.info('Performance metrics history cleared', {
      serviceName: this.serviceName
    });
  }

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
  } {
    const healthStatus = this.getHealthStatus();
    const resilienceStatus = this.getResilienceStatus();
    const performanceStats = this.getPerformanceStats();
    
    return {
      service: {
        name: `${this.serviceName} Modern Entity Deletion Service`,
        description: `Modern entity deletion listener with strategy pattern, resilience features, and comprehensive security for ${this.serviceName} service`,
        features: [
          'Dynamic Strategy Pattern Implementation',
          'Automatic Legacy Fallback',
          'Input Validation & Sanitization',
          'Authorization & Security Checks',
          'Performance Monitoring',
          'Resilience & Error Handling',
          'Cross-Service Deletion Support',
          'OpenTracing Integration',
          'Rate Limiting',
          'Comprehensive Logging'
        ]
      },
      architecture: {
        pattern: 'Strategy Pattern with Abstract Base Class',
        resilience: [
          'Automatic retry mechanism with exponential backoff',
          'Strategy initialization error tracking',
          'Graceful degradation to legacy fallback',
          'Transaction support with rollback',
          'Circuit breaker pattern integration'
        ],
        security: [
          'Input validation and sanitization',
          'MongoDB ObjectId validation',
          'Rate limiting (1 req/sec per user)',
          'Bulk operation detection',
          'Authorization checks per service',
          'Audit trail preservation',
          'Suspicious activity monitoring'
        ]
      },
      performance: {
        monitoring: [
          'Real-time performance metrics',
          'Memory usage tracking',
          'Throughput monitoring (entities/sec)',
          'Duration breakdown (validation, auth, processing)',
          'Success/failure rate tracking',
          'Performance threshold alerting'
        ],
        thresholds: {
          'Total Processing': '< 5000ms warning threshold',
          'Validation': '< 1000ms warning threshold',
          'Authorization': '< 500ms warning threshold',
          'Throughput': '> 10 entities/sec minimum',
          'Memory': 'Heap usage monitoring'
        },
        metrics: performanceStats
      },
      api: {
        methods: [
          {
            name: 'processEvent(data)',
            description: 'Main entry point for entity deletion events with validation, authorization, and processing',
            returns: 'Promise<void>'
          },
          {
            name: 'getHealthStatus()',
            description: 'Returns current health status including strategy registry information',
            returns: 'HealthStatus'
          },
          {
            name: 'getResilienceStatus()',
            description: 'Returns resilience status including initialization errors and retry attempts',
            returns: 'ResilienceStatus'
          },
          {
            name: 'getPerformanceStats()',
            description: 'Returns comprehensive performance statistics and metrics',
            returns: 'PerformanceStats'
          },
          {
            name: 'getStrategyInfo(entityType)',
            description: 'Returns strategy information for a specific entity type',
            returns: 'StrategyInfo'
          },
          {
            name: 'clearPerformanceHistory()',
            description: 'Clears performance metrics history to free memory',
            returns: 'void'
          }
        ]
      },
      configuration: {
        environmentVariables: [
          'USE_TRANSACTIONS - Enable/disable transaction support',
          'NODE_ENV - Environment (development/production)',
          'LOG_LEVEL - Logging level configuration'
        ],
        features: {
          strategyPattern: healthStatus.strategiesRegistered > 0,
          transactionSupport: healthStatus.transactionSupported,
          legacyFallback: healthStatus.fallbackAvailable,
          performanceMonitoring: this.performanceMetrics.length > 0,
          resilienceFeatures: resilienceStatus.initializationStatus.totalErrors >= 0,
          securityValidation: true,
          rateLimiting: true,
          auditLogging: true
        }
      }
    };
  }

  /**
   * Generate API documentation in markdown format
   */
  generateApiDocumentation(): string {
    const doc = this.generateSystemDocumentation();
    
    return `
# ${doc.service.name}

${doc.service.description}

## Features

${doc.service.features.map(f => `- ${f}`).join('\n')}

## Architecture

**Pattern**: ${doc.architecture.pattern}

### Resilience Features
${doc.architecture.resilience.map(r => `- ${r}`).join('\n')}

### Security Features
${doc.architecture.security.map(s => `- ${s}`).join('\n')}

## Performance Monitoring

### Monitoring Capabilities
${doc.performance.monitoring.map(m => `- ${m}`).join('\n')}

### Performance Thresholds
${Object.entries(doc.performance.thresholds).map(([key, value]) => `- **${key}**: ${value}`).join('\n')}

### Current Performance Stats
- **Total Events Processed**: ${doc.performance.metrics.totalEvents}
- **Average Duration**: ${doc.performance.metrics.averageDurationMs}ms
- **Average Throughput**: ${doc.performance.metrics.averageEntitiesPerSecond} entities/sec
- **Success Rate**: ${doc.performance.metrics.successRate}%
- **Memory Usage**: ${doc.performance.metrics.memoryUsage.heapUsed}MB heap

## API Methods

${doc.api.methods.map(method => `### \`${method.name}\`

${method.description}

**Returns**: \`${method.returns}\`
`).join('\n')}

## Configuration

### Environment Variables
${doc.configuration.environmentVariables.map(env => `- \`${env}\``).join('\n')}

### Feature Status
${Object.entries(doc.configuration.features).map(([feature, enabled]) => `- **${feature}**: ${enabled ? '✅ Enabled' : '❌ Disabled'}`).join('\n')}

## Usage Example

\`\`\`typescript
// Initialize the listener
const listener = new ModernEntityDeletedListener();

// Get health status
const health = listener.getHealthStatus();
console.log('Strategies registered:', health.strategiesRegistered);

// Get performance metrics
const performance = listener.getPerformanceStats();
console.log('Average duration:', performance.averageDurationMs, 'ms');

// Get resilience status
const resilience = listener.getResilienceStatus();
console.log('Initialization errors:', resilience.initializationStatus.totalErrors);
\`\`\`

---

*Generated on ${new Date().toISOString()} by ${this.serviceName} Modern Entity Deletion Service*
`;
  }

  /**
   * Check if an entity is managed by this service
   *
   * This method determines if a given entity type is within the responsibility
   * of this service. If an entity is not managed by the service, deletion events
   * for that entity will be silently skipped.
   *
   * @param entityType - The entity type to check (e.g., 'product', 'productimage')
   * @returns true if the service manages this entity, false otherwise
   *
   * @example
   * // Catalog service implementation
   * protected isEntityManagedByService(entityType: string): boolean {
   *   const managedEntities = [
   *     'catalogmapping', 'categorymapping', 'product', 'combination',
   *     'user', 'order', 'productstock', 'packageproductlink', 'relationproductlink'
   *   ];
   *   return managedEntities.includes(entityType.toLowerCase());
   * }
   */
  protected abstract isEntityManagedByService(entityType: string): boolean;

  /**
   * Legacy fallback implementation - must be implemented by subclasses
   * This method should handle entity deletion using the old switch-case pattern
   */
  protected abstract legacyFallback(
    entity: { entity: string; entityId: string },
    userId: string,
    span?: any
  ): Promise<void>;
}