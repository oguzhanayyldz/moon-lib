/**
 * Security Event Types for Structured Logging
 * 
 * Defines the different types of security events that can be logged
 * across the Moon Project microservices architecture.
 */

export enum SecurityEventType {
    // Rate Limiting Events
    RATE_LIMIT_VIOLATION = 'RATE_LIMIT_VIOLATION',
    RATE_LIMIT_WARNING = 'RATE_LIMIT_WARNING',
    RATE_LIMIT_BLOCKED = 'RATE_LIMIT_BLOCKED',
    
    // CSRF Protection Events
    CSRF_TOKEN_MISSING = 'CSRF_TOKEN_MISSING',
    CSRF_TOKEN_INVALID = 'CSRF_TOKEN_INVALID',
    CSRF_TOKEN_EXPIRED = 'CSRF_TOKEN_EXPIRED',
    CSRF_VALIDATION_SUCCESS = 'CSRF_VALIDATION_SUCCESS',
    CSRF_TOKEN_REFRESH = 'CSRF_TOKEN_REFRESH',
    
    // Brute Force Protection Events
    BRUTE_FORCE_ATTEMPT = 'BRUTE_FORCE_ATTEMPT',
    BRUTE_FORCE_BLOCKED = 'BRUTE_FORCE_BLOCKED',
    BRUTE_FORCE_WARNING = 'BRUTE_FORCE_WARNING',
    
    // Input Validation Events
    XSS_ATTEMPT_DETECTED = 'XSS_ATTEMPT_DETECTED',
    SQL_INJECTION_ATTEMPT = 'SQL_INJECTION_ATTEMPT',
    NOSQL_INJECTION_ATTEMPT = 'NOSQL_INJECTION_ATTEMPT',
    INPUT_VALIDATION_FAILED = 'INPUT_VALIDATION_FAILED',
    
    // File Upload Security Events
    FILE_TYPE_VIOLATION = 'FILE_TYPE_VIOLATION',
    FILE_SIZE_VIOLATION = 'FILE_SIZE_VIOLATION',
    MALICIOUS_FILE_DETECTED = 'MALICIOUS_FILE_DETECTED',
    
    // Authentication & Authorization Events
    AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
    AUTHENTICATION_SUCCESS = 'AUTHENTICATION_SUCCESS',
    AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
    SESSION_HIJACK_ATTEMPT = 'SESSION_HIJACK_ATTEMPT',
    
    // Security Headers Events
    CORS_VIOLATION = 'CORS_VIOLATION',
    SECURITY_HEADER_MISSING = 'SECURITY_HEADER_MISSING',
    CSP_VIOLATION = 'CSP_VIOLATION',
    
    // General Security Events
    SECURITY_MIDDLEWARE_ERROR = 'SECURITY_MIDDLEWARE_ERROR',
    SECURITY_CONFIG_ERROR = 'SECURITY_CONFIG_ERROR',
    SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
    SECURITY_AUDIT_LOG = 'SECURITY_AUDIT_LOG'
}

export enum SecurityEventSeverity {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL'
}

export interface SecurityEventMetadata {
    // Basic event information
    eventType: SecurityEventType;
    severity: SecurityEventSeverity;
    timestamp: Date;
    serviceName: string;
    
    // Request context
    requestId?: string;
    userId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    endpoint?: string;
    httpMethod?: string;
    
    // Security specific data
    securityReason?: string;
    blockedReason?: string;
    attemptCount?: number;
    blockDuration?: number;
    
    // Additional context
    additionalData?: Record<string, any>;
    
    // Metrics data
    responseTime?: number;
    cpuUsage?: number;
    memoryUsage?: number;
}

export interface SecurityLogEntry {
    level: 'error' | 'warn' | 'info' | 'debug';
    message: string;
    metadata: SecurityEventMetadata;
    correlationId?: string;
    
    // Performance tracking
    processingTimeMs?: number;
    
    // Error details (if applicable)
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

// Helper function to get severity level based on event type
export function getEventSeverity(eventType: SecurityEventType): SecurityEventSeverity {
    const criticalEvents = [
        SecurityEventType.BRUTE_FORCE_BLOCKED,
        SecurityEventType.SQL_INJECTION_ATTEMPT,
        SecurityEventType.NOSQL_INJECTION_ATTEMPT,
        SecurityEventType.MALICIOUS_FILE_DETECTED,
        SecurityEventType.SESSION_HIJACK_ATTEMPT
    ];
    
    const highSeverityEvents = [
        SecurityEventType.BRUTE_FORCE_ATTEMPT,
        SecurityEventType.XSS_ATTEMPT_DETECTED,
        SecurityEventType.CSRF_TOKEN_INVALID,
        SecurityEventType.AUTHENTICATION_FAILED,
        SecurityEventType.AUTHORIZATION_FAILED
    ];
    
    const mediumSeverityEvents = [
        SecurityEventType.RATE_LIMIT_VIOLATION,
        SecurityEventType.CSRF_TOKEN_MISSING,
        SecurityEventType.CORS_VIOLATION,
        SecurityEventType.FILE_TYPE_VIOLATION
    ];
    
    if (criticalEvents.includes(eventType)) {
        return SecurityEventSeverity.CRITICAL;
    }
    
    if (highSeverityEvents.includes(eventType)) {
        return SecurityEventSeverity.HIGH;
    }
    
    if (mediumSeverityEvents.includes(eventType)) {
        return SecurityEventSeverity.MEDIUM;
    }
    
    return SecurityEventSeverity.LOW;
}