"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = void 0;
const api_client_types_1 = require("../common/types/api-client.types");
const logger_service_1 = require("./logger.service");
class CircuitBreaker {
    constructor(config, serviceName) {
        this.config = config;
        this.serviceName = serviceName;
        this.state = api_client_types_1.CircuitBreakerState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.halfOpenCallCount = 0;
        // Incremented on every transition into HALF_OPEN. A call carries the round it took its slot in,
        // so a call that finishes after its round ended cannot give a slot back to a later round.
        this.halfOpenRound = 0;
    }
    async execute(fn) {
        // Check circuit state before execution
        if (this.state === api_client_types_1.CircuitBreakerState.OPEN) {
            if (this.shouldAttemptReset()) {
                this.transitionToHalfOpen();
            }
            else {
                this.logEvent('Circuit breaker is open, request rejected');
                throw new api_client_types_1.CircuitBreakerOpenError(this.serviceName);
            }
        }
        // In half-open state, limit the number of calls
        const slotRound = this.state === api_client_types_1.CircuitBreakerState.HALF_OPEN ? this.halfOpenRound : undefined;
        if (slotRound !== undefined) {
            const maxCalls = this.config.halfOpenMaxCalls || 3;
            if (this.halfOpenCallCount >= maxCalls) {
                this.logEvent('Half-open call limit exceeded, rejecting request');
                throw new api_client_types_1.CircuitBreakerOpenError(this.serviceName);
            }
            this.halfOpenCallCount++;
        }
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure(error, slotRound);
            throw error;
        }
    }
    shouldAttemptReset() {
        if (!this.lastFailureTime)
            return false;
        const timeSinceLastFailure = Date.now() - this.lastFailureTime;
        return timeSinceLastFailure >= this.config.resetTimeout;
    }
    transitionToHalfOpen() {
        this.state = api_client_types_1.CircuitBreakerState.HALF_OPEN;
        this.halfOpenCallCount = 0;
        this.halfOpenRound++;
        this.logEvent('Circuit breaker transitioned to HALF_OPEN');
    }
    onSuccess() {
        this.lastSuccessTime = Date.now();
        if (this.state === api_client_types_1.CircuitBreakerState.HALF_OPEN) {
            // Successful call in half-open state closes the circuit
            this.state = api_client_types_1.CircuitBreakerState.CLOSED;
            this.failureCount = 0;
            this.halfOpenCallCount = 0;
            this.logEvent('Circuit breaker closed after successful call');
        }
        this.successCount++;
    }
    onFailure(error, slotRound) {
        this.lastFailureTime = Date.now();
        // Only count failures for expected error types
        if (this.isExpectedError(error)) {
            this.failureCount++;
            if (this.state === api_client_types_1.CircuitBreakerState.HALF_OPEN) {
                // Failure in half-open state opens the circuit immediately
                this.state = api_client_types_1.CircuitBreakerState.OPEN;
                this.halfOpenCallCount = 0;
                this.logEvent('Circuit breaker opened due to failure in half-open state');
            }
            else if (this.state === api_client_types_1.CircuitBreakerState.CLOSED &&
                this.failureCount >= this.config.failureThreshold) {
                // Too many failures in closed state opens the circuit
                this.state = api_client_types_1.CircuitBreakerState.OPEN;
                this.logEvent(`Circuit breaker opened due to ${this.failureCount} failures`);
            }
        }
        else if (slotRound === this.halfOpenRound && this.state === api_client_types_1.CircuitBreakerState.HALF_OPEN) {
            // A non-counted failure (e.g. 4xx) neither closes nor reopens the circuit, so give the
            // slot back; otherwise such failures use up every slot and the circuit stays HALF_OPEN,
            // rejecting all calls until the process restarts. Only the round that handed out the slot
            // takes it back: a call outliving its round would otherwise free a slot it never held here.
            // Math.max is a defensive floor only — the round check already keeps the counter >= 0.
            this.halfOpenCallCount = Math.max(0, this.halfOpenCallCount - 1);
            this.logEvent('Non-counted failure in half-open state, call slot released');
        }
    }
    isExpectedError(error) {
        var _a;
        if (!error)
            return false;
        // Check for network errors
        if (error.code && this.config.expectedErrors.includes(error.code)) {
            return true;
        }
        // Check for HTTP status codes
        if ((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) {
            const status = error.response.status.toString();
            return this.config.expectedErrors.includes(status) ||
                (error.response.status >= 500 && error.response.status < 600);
        }
        return false;
    }
    getMetrics() {
        return {
            state: this.state,
            failures: this.failureCount,
            successes: this.successCount,
            timeouts: 0, // Will be implemented with request timeout tracking
            fallbackCalls: 0, // Will be implemented with fallback mechanism
            lastFailureTime: this.lastFailureTime,
            lastSuccessTime: this.lastSuccessTime
        };
    }
    getCurrentState() {
        return this.state;
    }
    reset() {
        this.state = api_client_types_1.CircuitBreakerState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.halfOpenCallCount = 0;
        this.lastFailureTime = undefined;
        this.lastSuccessTime = undefined;
        this.logEvent('Circuit breaker manually reset');
    }
    logEvent(message) {
        logger_service_1.logger.info(`[CircuitBreaker:${this.serviceName}] ${message}`, {
            state: this.state,
            failures: this.failureCount,
            successes: this.successCount,
            halfOpenCalls: this.halfOpenCallCount
        });
    }
}
exports.CircuitBreaker = CircuitBreaker;
//# sourceMappingURL=circuitBreaker.service.js.map