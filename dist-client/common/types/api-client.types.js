"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitExceededError = exports.ApiRequestTimeoutError = exports.CircuitBreakerOpenError = exports.BaseApiError = exports.CircuitBreakerState = void 0;
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
/**
 * Thrown when a request exceeds the client's queue deadline (`queue.timeout`).
 * The underlying HTTP request and its retry loop are aborted at that moment, so no
 * further attempt is sent after this error reaches the caller. The message is safe
 * to show to users: it carries no URL, payload or raw runtime error text.
 *
 * `code` matches axios' own timeout code so existing error categorizers treat it as a
 * timeout. The message deliberately avoids the word "timeout": command listeners retry
 * whole commands on `message.includes('timeout')`, and this change must not widen that.
 */
class ApiRequestTimeoutError extends BaseApiError {
    constructor(integrationName, timeoutMs) {
        super(`${integrationName} API request timed out after ${timeoutMs} ms; request aborted`);
        this.integrationName = integrationName;
        this.timeoutMs = timeoutMs;
        this.category = 'TIMEOUT';
        this.priority = 'MEDIUM';
        this.isRetryable = true;
        this.code = 'ECONNABORTED';
        Object.setPrototypeOf(this, ApiRequestTimeoutError.prototype);
    }
}
exports.ApiRequestTimeoutError = ApiRequestTimeoutError;
class RateLimitExceededError extends BaseApiError {
    constructor(retryAfter) {
        super(`Rate limit exceeded${retryAfter ? `, retry after ${retryAfter}ms` : ''}`);
        this.category = 'RATE_LIMIT';
        this.priority = 'MEDIUM';
        this.isRetryable = true;
    }
}
exports.RateLimitExceededError = RateLimitExceededError;
