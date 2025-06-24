import {
    SecurityEventType,
    SecurityEventSeverity,
    SecurityEventMetadata,
    SecurityLogEntry,
    SecurityMetricsData,
    getEventSeverity
} from './SecurityEventTypes';

/**
 * SecurityLogger - Centralized Security Event Logging Service
 * 
 * Provides structured logging capabilities for security events across
 * all Moon Project microservices. Replaces console.error usage with
 * proper structured logging that can be aggregated and monitored.
 */
export class SecurityLogger {
    private serviceName: string;
    private metricsCollector?: (metrics: SecurityMetricsData) => void;
    
    constructor(
        serviceName: string,
        metricsCollector?: (metrics: SecurityMetricsData) => void
    ) {
        this.serviceName = serviceName;
        this.metricsCollector = metricsCollector;
    }
    
    /**
     * Log a security event with structured data
     */
    public logSecurityEvent(
        eventType: SecurityEventType,
        message: string,
        context: Partial<SecurityEventMetadata> = {},
        error?: Error
    ): void {
        const severity = getEventSeverity(eventType);
        const timestamp = new Date();
        const correlationId = this.generateCorrelationId();
        
        const metadata: SecurityEventMetadata = {
            eventType,
            severity,
            timestamp,
            serviceName: this.serviceName,
            ...context
        };
        
        const logEntry: SecurityLogEntry = {
            level: this.mapSeverityToLogLevel(severity),
            message,
            metadata,
            correlationId
        };
        
        if (error) {
            logEntry.error = {
                name: error.name,
                message: error.message,
                stack: error.stack
            };
        }
        
        // Output structured log
        this.outputStructuredLog(logEntry);
        
        // Collect metrics if collector is available
        if (this.metricsCollector) {
            this.collectMetrics(eventType, timestamp);
        }
    }
    
    /**
     * Log rate limiting violations
     */
    public logRateLimitViolation(
        ipAddress: string,
        endpoint: string,
        currentCount: number,
        maxAllowed: number,
        windowMs: number,
        additionalContext: Record<string, any> = {}
    ): void {
        this.logSecurityEvent(
            SecurityEventType.RATE_LIMIT_VIOLATION,
            `Rate limit exceeded: ${currentCount}/${maxAllowed} requests in ${windowMs}ms`,
            {
                ipAddress,
                endpoint,
                attemptCount: currentCount,
                additionalData: {
                    maxAllowed,
                    windowMs,
                    ...additionalContext
                }
            }
        );
    }
    
    /**
     * Log CSRF token validation failures
     */
    public logCSRFViolation(
        eventType: SecurityEventType.CSRF_TOKEN_MISSING | SecurityEventType.CSRF_TOKEN_INVALID | SecurityEventType.CSRF_TOKEN_EXPIRED,
        requestId: string,
        userId?: string,
        endpoint?: string,
        additionalContext: Record<string, any> = {}
    ): void {
        this.logSecurityEvent(
            eventType,
            `CSRF token validation failed: ${eventType}`,
            {
                requestId,
                userId,
                endpoint,
                additionalData: additionalContext
            }
        );
    }
    
    /**
     * Log brute force attempts
     */
    public logBruteForceAttempt(
        ipAddress: string,
        userId: string,
        attemptCount: number,
        isBlocked: boolean,
        blockDuration?: number,
        additionalContext: Record<string, any> = {}
    ): void {
        const eventType = isBlocked 
            ? SecurityEventType.BRUTE_FORCE_BLOCKED 
            : SecurityEventType.BRUTE_FORCE_ATTEMPT;
            
        this.logSecurityEvent(
            eventType,
            `Brute force ${isBlocked ? 'blocked' : 'attempt'}: ${attemptCount} attempts from ${ipAddress}`,
            {
                ipAddress,
                userId,
                attemptCount,
                blockDuration,
                blockedReason: isBlocked ? 'Exceeded maximum attempts' : undefined,
                additionalData: additionalContext
            }
        );
    }
    
    /**
     * Log input validation failures
     */
    public logInputValidationFailure(
        eventType: SecurityEventType,
        endpoint: string,
        requestData: any,
        validationErrors: string[],
        additionalContext: Record<string, any> = {}
    ): void {
        this.logSecurityEvent(
            eventType,
            `Input validation failed: ${validationErrors.join(', ')}`,
            {
                endpoint,
                securityReason: 'Input validation failure',
                additionalData: {
                    validationErrors,
                    requestDataSample: this.sanitizeRequestData(requestData),
                    ...additionalContext
                }
            }
        );
    }
    
    /**
     * Log security middleware errors
     */
    public logSecurityMiddlewareError(
        middlewareName: string,
        error: Error,
        requestContext: Record<string, any> = {}
    ): void {
        this.logSecurityEvent(
            SecurityEventType.SECURITY_MIDDLEWARE_ERROR,
            `Security middleware error in ${middlewareName}: ${error.message}`,
            {
                additionalData: {
                    middlewareName,
                    requestContext: this.sanitizeRequestData(requestContext)
                }
            },
            error
        );
    }
    
    /**
     * Log general security audit events
     */
    public logSecurityAudit(
        message: string,
        userId?: string,
        action?: string,
        resource?: string,
        additionalContext: Record<string, any> = {}
    ): void {
        this.logSecurityEvent(
            SecurityEventType.SECURITY_AUDIT_LOG,
            message,
            {
                userId,
                additionalData: {
                    action,
                    resource,
                    ...additionalContext
                }
            }
        );
    }
    
    /**
     * Create a convenience method for replacing console.error calls
     */
    public error(message: string, error?: Error, context: Record<string, any> = {}): void {
        this.logSecurityEvent(
            SecurityEventType.SECURITY_MIDDLEWARE_ERROR,
            message,
            {
                additionalData: context
            },
            error
        );
    }
    
    /**
     * Create a convenience method for warnings
     */
    public warn(message: string, context: Record<string, any> = {}): void {
        this.logSecurityEvent(
            SecurityEventType.SECURITY_AUDIT_LOG,
            message,
            {
                severity: SecurityEventSeverity.MEDIUM,
                additionalData: context
            }
        );
    }
    
    /**
     * Create a convenience method for info logs
     */
    public info(message: string, context: Record<string, any> = {}): void {
        this.logSecurityEvent(
            SecurityEventType.SECURITY_AUDIT_LOG,
            message,
            {
                severity: SecurityEventSeverity.LOW,
                additionalData: context
            }
        );
    }
    
    // Private helper methods
    
    private mapSeverityToLogLevel(severity: SecurityEventSeverity): 'error' | 'warn' | 'info' | 'debug' {
        switch (severity) {
            case SecurityEventSeverity.CRITICAL:
            case SecurityEventSeverity.HIGH:
                return 'error';
            case SecurityEventSeverity.MEDIUM:
                return 'warn';
            case SecurityEventSeverity.LOW:
            default:
                return 'info';
        }
    }
    
    private outputStructuredLog(logEntry: SecurityLogEntry): void {
        const output = {
            timestamp: logEntry.metadata.timestamp.toISOString(),
            level: logEntry.level,
            service: this.serviceName,
            message: logEntry.message,
            eventType: logEntry.metadata.eventType,
            severity: logEntry.metadata.severity,
            correlationId: logEntry.correlationId,
            metadata: logEntry.metadata,
            ...(logEntry.error && { error: logEntry.error })
        };
        
        // Output as JSON for log aggregation
        console.log(JSON.stringify(output));
    }
    
    private collectMetrics(eventType: SecurityEventType, timestamp: Date): void {
        if (!this.metricsCollector) return;
        
        const metricsData: SecurityMetricsData = {
            eventType,
            serviceName: this.serviceName,
            count: 1,
            timestamp,
            labels: {
                event_type: eventType,
                service: this.serviceName,
                severity: getEventSeverity(eventType)
            }
        };
        
        this.metricsCollector(metricsData);
    }
    
    private generateCorrelationId(): string {
        return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    private sanitizeRequestData(data: any): any {
        if (!data) return data;
        
        // Remove sensitive fields
        const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth', 'authorization'];
        const sanitized = { ...data };
        
        for (const field of sensitiveFields) {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        }
        
        return sanitized;
    }
}

// Export a factory function for creating SecurityLogger instances
export function createSecurityLogger(
    serviceName: string,
    metricsCollector?: (metrics: SecurityMetricsData) => void
): SecurityLogger {
    return new SecurityLogger(serviceName, metricsCollector);
}

// Export singleton instances for common services
export const authSecurityLogger = new SecurityLogger('auth');
export const catalogSecurityLogger = new SecurityLogger('catalog');
export const ordersSecurityLogger = new SecurityLogger('orders');
export const inventorySecurityLogger = new SecurityLogger('inventory');
export const productsSecurityLogger = new SecurityLogger('products');
export const pricingSecurityLogger = new SecurityLogger('pricing');
export const integrationSecurityLogger = new SecurityLogger('integration');
export const shopifySecurityLogger = new SecurityLogger('shopify');
export const trendyolSecurityLogger = new SecurityLogger('trendyol');