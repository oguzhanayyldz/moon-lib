"use strict";
/**
 * Security Event Types for Structured Logging
 *
 * Defines the different types of security events that can be logged
 * across the Moon Project microservices architecture.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityEventSeverity = exports.SecurityEventType = void 0;
exports.getEventSeverity = getEventSeverity;
var SecurityEventType;
(function (SecurityEventType) {
    // Rate Limiting Events
    SecurityEventType["RATE_LIMIT_VIOLATION"] = "RATE_LIMIT_VIOLATION";
    SecurityEventType["RATE_LIMIT_WARNING"] = "RATE_LIMIT_WARNING";
    SecurityEventType["RATE_LIMIT_BLOCKED"] = "RATE_LIMIT_BLOCKED";
    // CSRF Protection Events
    SecurityEventType["CSRF_TOKEN_MISSING"] = "CSRF_TOKEN_MISSING";
    SecurityEventType["CSRF_TOKEN_INVALID"] = "CSRF_TOKEN_INVALID";
    SecurityEventType["CSRF_TOKEN_EXPIRED"] = "CSRF_TOKEN_EXPIRED";
    SecurityEventType["CSRF_VALIDATION_SUCCESS"] = "CSRF_VALIDATION_SUCCESS";
    SecurityEventType["CSRF_TOKEN_REFRESH"] = "CSRF_TOKEN_REFRESH";
    // Brute Force Protection Events
    SecurityEventType["BRUTE_FORCE_ATTEMPT"] = "BRUTE_FORCE_ATTEMPT";
    SecurityEventType["BRUTE_FORCE_BLOCKED"] = "BRUTE_FORCE_BLOCKED";
    SecurityEventType["BRUTE_FORCE_WARNING"] = "BRUTE_FORCE_WARNING";
    // Input Validation Events
    SecurityEventType["XSS_ATTEMPT_DETECTED"] = "XSS_ATTEMPT_DETECTED";
    SecurityEventType["SQL_INJECTION_ATTEMPT"] = "SQL_INJECTION_ATTEMPT";
    SecurityEventType["NOSQL_INJECTION_ATTEMPT"] = "NOSQL_INJECTION_ATTEMPT";
    SecurityEventType["INPUT_VALIDATION_FAILED"] = "INPUT_VALIDATION_FAILED";
    // File Upload Security Events
    SecurityEventType["FILE_TYPE_VIOLATION"] = "FILE_TYPE_VIOLATION";
    SecurityEventType["FILE_SIZE_VIOLATION"] = "FILE_SIZE_VIOLATION";
    SecurityEventType["MALICIOUS_FILE_DETECTED"] = "MALICIOUS_FILE_DETECTED";
    // Authentication & Authorization Events
    SecurityEventType["AUTHENTICATION_FAILED"] = "AUTHENTICATION_FAILED";
    SecurityEventType["AUTHENTICATION_SUCCESS"] = "AUTHENTICATION_SUCCESS";
    SecurityEventType["AUTHORIZATION_FAILED"] = "AUTHORIZATION_FAILED";
    SecurityEventType["SESSION_HIJACK_ATTEMPT"] = "SESSION_HIJACK_ATTEMPT";
    // Security Headers Events
    SecurityEventType["CORS_VIOLATION"] = "CORS_VIOLATION";
    SecurityEventType["SECURITY_HEADER_MISSING"] = "SECURITY_HEADER_MISSING";
    SecurityEventType["CSP_VIOLATION"] = "CSP_VIOLATION";
    // General Security Events
    SecurityEventType["SECURITY_MIDDLEWARE_ERROR"] = "SECURITY_MIDDLEWARE_ERROR";
    SecurityEventType["SECURITY_CONFIG_ERROR"] = "SECURITY_CONFIG_ERROR";
    SecurityEventType["SUSPICIOUS_ACTIVITY"] = "SUSPICIOUS_ACTIVITY";
    SecurityEventType["SECURITY_AUDIT_LOG"] = "SECURITY_AUDIT_LOG";
})(SecurityEventType || (exports.SecurityEventType = SecurityEventType = {}));
var SecurityEventSeverity;
(function (SecurityEventSeverity) {
    SecurityEventSeverity["LOW"] = "LOW";
    SecurityEventSeverity["MEDIUM"] = "MEDIUM";
    SecurityEventSeverity["HIGH"] = "HIGH";
    SecurityEventSeverity["CRITICAL"] = "CRITICAL";
})(SecurityEventSeverity || (exports.SecurityEventSeverity = SecurityEventSeverity = {}));
// Helper function to get severity level based on event type
function getEventSeverity(eventType) {
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
//# sourceMappingURL=SecurityEventTypes.js.map