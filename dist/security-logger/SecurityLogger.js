"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trendyolSecurityLogger = exports.shopifySecurityLogger = exports.integrationSecurityLogger = exports.pricingSecurityLogger = exports.productsSecurityLogger = exports.inventorySecurityLogger = exports.ordersSecurityLogger = exports.catalogSecurityLogger = exports.authSecurityLogger = exports.SecurityLogger = void 0;
exports.createSecurityLogger = createSecurityLogger;
const SecurityEventTypes_1 = require("./SecurityEventTypes");
/**
 * SecurityLogger - Centralized Security Event Logging Service
 *
 * Provides structured logging capabilities for security events across
 * all Moon Project microservices. Replaces console.error usage with
 * proper structured logging that can be aggregated and monitored.
 */
class SecurityLogger {
    constructor(serviceName, metricsCollector) {
        this.serviceName = serviceName;
        this.metricsCollector = metricsCollector;
    }
    /**
     * Log a security event with structured data
     */
    logSecurityEvent(eventType, message, context = {}, error) {
        const severity = (0, SecurityEventTypes_1.getEventSeverity)(eventType);
        const timestamp = new Date();
        const correlationId = this.generateCorrelationId();
        const metadata = Object.assign({ eventType,
            severity,
            timestamp, serviceName: this.serviceName }, context);
        const logEntry = {
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
    logRateLimitViolation(ipAddress, endpoint, currentCount, maxAllowed, windowMs, additionalContext = {}) {
        this.logSecurityEvent(SecurityEventTypes_1.SecurityEventType.RATE_LIMIT_VIOLATION, `Rate limit exceeded: ${currentCount}/${maxAllowed} requests in ${windowMs}ms`, {
            ipAddress,
            endpoint,
            attemptCount: currentCount,
            additionalData: Object.assign({ maxAllowed,
                windowMs }, additionalContext)
        });
    }
    /**
     * Log CSRF token validation failures
     */
    logCSRFViolation(eventType, requestId, userId, endpoint, additionalContext = {}) {
        this.logSecurityEvent(eventType, `CSRF token validation failed: ${eventType}`, {
            requestId,
            userId,
            endpoint,
            additionalData: additionalContext
        });
    }
    /**
     * Log brute force attempts
     */
    logBruteForceAttempt(ipAddress, userId, attemptCount, isBlocked, blockDuration, additionalContext = {}) {
        const eventType = isBlocked
            ? SecurityEventTypes_1.SecurityEventType.BRUTE_FORCE_BLOCKED
            : SecurityEventTypes_1.SecurityEventType.BRUTE_FORCE_ATTEMPT;
        this.logSecurityEvent(eventType, `Brute force ${isBlocked ? 'blocked' : 'attempt'}: ${attemptCount} attempts from ${ipAddress}`, {
            ipAddress,
            userId,
            attemptCount,
            blockDuration,
            blockedReason: isBlocked ? 'Exceeded maximum attempts' : undefined,
            additionalData: additionalContext
        });
    }
    /**
     * Log input validation failures
     */
    logInputValidationFailure(eventType, endpoint, requestData, validationErrors, additionalContext = {}) {
        this.logSecurityEvent(eventType, `Input validation failed: ${validationErrors.join(', ')}`, {
            endpoint,
            securityReason: 'Input validation failure',
            additionalData: Object.assign({ validationErrors, requestDataSample: this.sanitizeRequestData(requestData) }, additionalContext)
        });
    }
    /**
     * Log security middleware errors
     */
    logSecurityMiddlewareError(middlewareName, error, requestContext = {}) {
        this.logSecurityEvent(SecurityEventTypes_1.SecurityEventType.SECURITY_MIDDLEWARE_ERROR, `Security middleware error in ${middlewareName}: ${error.message}`, {
            additionalData: {
                middlewareName,
                requestContext: this.sanitizeRequestData(requestContext)
            }
        }, error);
    }
    /**
     * Log general security audit events
     */
    logSecurityAudit(message, userId, action, resource, additionalContext = {}) {
        this.logSecurityEvent(SecurityEventTypes_1.SecurityEventType.SECURITY_AUDIT_LOG, message, {
            userId,
            additionalData: Object.assign({ action,
                resource }, additionalContext)
        });
    }
    /**
     * Create a convenience method for replacing console.error calls
     */
    error(message, error, context = {}) {
        this.logSecurityEvent(SecurityEventTypes_1.SecurityEventType.SECURITY_MIDDLEWARE_ERROR, message, {
            additionalData: context
        }, error);
    }
    /**
     * Create a convenience method for warnings
     */
    warn(message, context = {}) {
        this.logSecurityEvent(SecurityEventTypes_1.SecurityEventType.SECURITY_AUDIT_LOG, message, {
            severity: SecurityEventTypes_1.SecurityEventSeverity.MEDIUM,
            additionalData: context
        });
    }
    /**
     * Create a convenience method for info logs
     */
    info(message, context = {}) {
        this.logSecurityEvent(SecurityEventTypes_1.SecurityEventType.SECURITY_AUDIT_LOG, message, {
            severity: SecurityEventTypes_1.SecurityEventSeverity.LOW,
            additionalData: context
        });
    }
    // Private helper methods
    mapSeverityToLogLevel(severity) {
        switch (severity) {
            case SecurityEventTypes_1.SecurityEventSeverity.CRITICAL:
            case SecurityEventTypes_1.SecurityEventSeverity.HIGH:
                return 'error';
            case SecurityEventTypes_1.SecurityEventSeverity.MEDIUM:
                return 'warn';
            case SecurityEventTypes_1.SecurityEventSeverity.LOW:
            default:
                return 'info';
        }
    }
    outputStructuredLog(logEntry) {
        const output = Object.assign({ timestamp: logEntry.metadata.timestamp.toISOString(), level: logEntry.level, service: this.serviceName, message: logEntry.message, eventType: logEntry.metadata.eventType, severity: logEntry.metadata.severity, correlationId: logEntry.correlationId, metadata: logEntry.metadata }, (logEntry.error && { error: logEntry.error }));
        // Output as JSON for log aggregation
        console.log(JSON.stringify(output));
    }
    collectMetrics(eventType, timestamp) {
        if (!this.metricsCollector)
            return;
        const metricsData = {
            eventType,
            serviceName: this.serviceName,
            count: 1,
            timestamp,
            labels: {
                event_type: eventType,
                service: this.serviceName,
                severity: (0, SecurityEventTypes_1.getEventSeverity)(eventType)
            }
        };
        this.metricsCollector(metricsData);
    }
    generateCorrelationId() {
        return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    sanitizeRequestData(data) {
        if (!data)
            return data;
        // Remove sensitive fields
        const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth', 'authorization'];
        const sanitized = Object.assign({}, data);
        for (const field of sensitiveFields) {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        }
        return sanitized;
    }
}
exports.SecurityLogger = SecurityLogger;
// Export a factory function for creating SecurityLogger instances
function createSecurityLogger(serviceName, metricsCollector) {
    return new SecurityLogger(serviceName, metricsCollector);
}
// Export singleton instances for common services
exports.authSecurityLogger = new SecurityLogger('auth');
exports.catalogSecurityLogger = new SecurityLogger('catalog');
exports.ordersSecurityLogger = new SecurityLogger('orders');
exports.inventorySecurityLogger = new SecurityLogger('inventory');
exports.productsSecurityLogger = new SecurityLogger('products');
exports.pricingSecurityLogger = new SecurityLogger('pricing');
exports.integrationSecurityLogger = new SecurityLogger('integration');
exports.shopifySecurityLogger = new SecurityLogger('shopify');
exports.trendyolSecurityLogger = new SecurityLogger('trendyol');
