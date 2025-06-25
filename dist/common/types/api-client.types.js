"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitExceededError = exports.CircuitBreakerOpenError = exports.BaseApiError = exports.CircuitBreakerState = void 0;
var CircuitBreakerState;
(function (CircuitBreakerState) {
    CircuitBreakerState["CLOSED"] = "CLOSED";
    CircuitBreakerState["OPEN"] = "OPEN";
    CircuitBreakerState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitBreakerState || (exports.CircuitBreakerState = CircuitBreakerState = {}));
class BaseApiError extends Error {
    constructor(message, originalError) {
        super(message);
        this.originalError = originalError;
        this.name = this.constructor.name;
    }
}
exports.BaseApiError = BaseApiError;
class CircuitBreakerOpenError extends BaseApiError {
    constructor(serviceName) {
        super(`Circuit breaker is open for service: ${serviceName}`);
        this.category = 'CIRCUIT_BREAKER';
        this.priority = 'HIGH';
        this.isRetryable = false;
    }
}
exports.CircuitBreakerOpenError = CircuitBreakerOpenError;
class RateLimitExceededError extends BaseApiError {
    constructor(retryAfter) {
        super(`Rate limit exceeded${retryAfter ? `, retry after ${retryAfter}ms` : ''}`);
        this.category = 'RATE_LIMIT';
        this.priority = 'MEDIUM';
        this.isRetryable = true;
    }
}
exports.RateLimitExceededError = RateLimitExceededError;
