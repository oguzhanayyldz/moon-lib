/**
 * Security Event Types for Structured Logging
 *
 * Defines the different types of security events that can be logged
 * across the Moon Project microservices architecture.
 */
export declare enum SecurityEventType {
    RATE_LIMIT_VIOLATION = "RATE_LIMIT_VIOLATION",
    RATE_LIMIT_WARNING = "RATE_LIMIT_WARNING",
    RATE_LIMIT_BLOCKED = "RATE_LIMIT_BLOCKED",
    CSRF_TOKEN_MISSING = "CSRF_TOKEN_MISSING",
    CSRF_TOKEN_INVALID = "CSRF_TOKEN_INVALID",
    CSRF_TOKEN_EXPIRED = "CSRF_TOKEN_EXPIRED",
    CSRF_VALIDATION_SUCCESS = "CSRF_VALIDATION_SUCCESS",
    CSRF_TOKEN_REFRESH = "CSRF_TOKEN_REFRESH",
    BRUTE_FORCE_ATTEMPT = "BRUTE_FORCE_ATTEMPT",
    BRUTE_FORCE_BLOCKED = "BRUTE_FORCE_BLOCKED",
    BRUTE_FORCE_WARNING = "BRUTE_FORCE_WARNING",
    XSS_ATTEMPT_DETECTED = "XSS_ATTEMPT_DETECTED",
    SQL_INJECTION_ATTEMPT = "SQL_INJECTION_ATTEMPT",
    NOSQL_INJECTION_ATTEMPT = "NOSQL_INJECTION_ATTEMPT",
    INPUT_VALIDATION_FAILED = "INPUT_VALIDATION_FAILED",
    FILE_TYPE_VIOLATION = "FILE_TYPE_VIOLATION",
    FILE_SIZE_VIOLATION = "FILE_SIZE_VIOLATION",
    MALICIOUS_FILE_DETECTED = "MALICIOUS_FILE_DETECTED",
    AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED",
    AUTHENTICATION_SUCCESS = "AUTHENTICATION_SUCCESS",
    AUTHORIZATION_FAILED = "AUTHORIZATION_FAILED",
    SESSION_HIJACK_ATTEMPT = "SESSION_HIJACK_ATTEMPT",
    CORS_VIOLATION = "CORS_VIOLATION",
    SECURITY_HEADER_MISSING = "SECURITY_HEADER_MISSING",
    CSP_VIOLATION = "CSP_VIOLATION",
    SECURITY_MIDDLEWARE_ERROR = "SECURITY_MIDDLEWARE_ERROR",
    SECURITY_CONFIG_ERROR = "SECURITY_CONFIG_ERROR",
    SUSPICIOUS_ACTIVITY = "SUSPICIOUS_ACTIVITY",
    SECURITY_AUDIT_LOG = "SECURITY_AUDIT_LOG"
}
export declare enum SecurityEventSeverity {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    CRITICAL = "CRITICAL"
}
export interface SecurityEventMetadata {
    eventType: SecurityEventType;
    severity: SecurityEventSeverity;
    timestamp: Date;
    serviceName: string;
    requestId?: string;
    userId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    endpoint?: string;
    httpMethod?: string;
    securityReason?: string;
    blockedReason?: string;
    attemptCount?: number;
    blockDuration?: number;
    additionalData?: Record<string, any>;
    responseTime?: number;
    cpuUsage?: number;
    memoryUsage?: number;
}
export interface SecurityLogEntry {
    level: 'error' | 'warn' | 'info' | 'debug';
    message: string;
    metadata: SecurityEventMetadata;
    correlationId?: string;
    processingTimeMs?: number;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
}
export interface SecurityMetricsData {
    eventType: SecurityEventType;
    serviceName: string;
    count: number;
    timestamp: Date;
    labels?: Record<string, string>;
}
export declare function getEventSeverity(eventType: SecurityEventType): SecurityEventSeverity;
