import { SecurityEventType, SecurityEventMetadata, SecurityMetricsData } from './SecurityEventTypes';
/**
 * SecurityLogger - Centralized Security Event Logging Service
 *
 * Provides structured logging capabilities for security events across
 * all Moon Project microservices. Replaces console.error usage with
 * proper structured logging that can be aggregated and monitored.
 */
export declare class SecurityLogger {
    private serviceName;
    private metricsCollector?;
    constructor(serviceName: string, metricsCollector?: (metrics: SecurityMetricsData) => void);
    /**
     * Log a security event with structured data
     */
    logSecurityEvent(eventType: SecurityEventType, message: string, context?: Partial<SecurityEventMetadata>, error?: Error): void;
    /**
     * Log rate limiting violations
     */
    logRateLimitViolation(ipAddress: string, endpoint: string, currentCount: number, maxAllowed: number, windowMs: number, additionalContext?: Record<string, any>): void;
    /**
     * Log CSRF token validation failures
     */
    logCSRFViolation(eventType: SecurityEventType.CSRF_TOKEN_MISSING | SecurityEventType.CSRF_TOKEN_INVALID | SecurityEventType.CSRF_TOKEN_EXPIRED, requestId: string, userId?: string, endpoint?: string, additionalContext?: Record<string, any>): void;
    /**
     * Log brute force attempts
     */
    logBruteForceAttempt(ipAddress: string, userId: string, attemptCount: number, isBlocked: boolean, blockDuration?: number, additionalContext?: Record<string, any>): void;
    /**
     * Log input validation failures
     */
    logInputValidationFailure(eventType: SecurityEventType, endpoint: string, requestData: any, validationErrors: string[], additionalContext?: Record<string, any>): void;
    /**
     * Log security middleware errors
     */
    logSecurityMiddlewareError(middlewareName: string, error: Error, requestContext?: Record<string, any>): void;
    /**
     * Log general security audit events
     */
    logSecurityAudit(message: string, userId?: string, action?: string, resource?: string, additionalContext?: Record<string, any>): void;
    /**
     * Create a convenience method for replacing console.error calls
     */
    error(message: string, error?: Error, context?: Record<string, any>): void;
    /**
     * Create a convenience method for warnings
     */
    warn(message: string, context?: Record<string, any>): void;
    /**
     * Create a convenience method for info logs
     */
    info(message: string, context?: Record<string, any>): void;
    private mapSeverityToLogLevel;
    private outputStructuredLog;
    private collectMetrics;
    private generateCorrelationId;
    private sanitizeRequestData;
}
export declare function createSecurityLogger(serviceName: string, metricsCollector?: (metrics: SecurityMetricsData) => void): SecurityLogger;
export declare const authSecurityLogger: SecurityLogger;
export declare const catalogSecurityLogger: SecurityLogger;
export declare const ordersSecurityLogger: SecurityLogger;
export declare const inventorySecurityLogger: SecurityLogger;
export declare const productsSecurityLogger: SecurityLogger;
export declare const pricingSecurityLogger: SecurityLogger;
export declare const integrationSecurityLogger: SecurityLogger;
export declare const shopifySecurityLogger: SecurityLogger;
export declare const trendyolSecurityLogger: SecurityLogger;
//# sourceMappingURL=SecurityLogger.d.ts.map