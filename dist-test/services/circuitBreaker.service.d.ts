import { CircuitBreakerState, CircuitBreakerConfig, CircuitBreakerMetrics } from '../common/types/api-client.types';
export declare class CircuitBreaker {
    private readonly config;
    private readonly serviceName;
    private state;
    private failureCount;
    private successCount;
    private lastFailureTime?;
    private lastSuccessTime?;
    private halfOpenCallCount;
    constructor(config: CircuitBreakerConfig, serviceName: string);
    execute<T>(fn: () => Promise<T>): Promise<T>;
    private shouldAttemptReset;
    private transitionToHalfOpen;
    private onSuccess;
    private onFailure;
    private isExpectedError;
    getMetrics(): CircuitBreakerMetrics;
    getCurrentState(): CircuitBreakerState;
    reset(): void;
    private logEvent;
}
//# sourceMappingURL=circuitBreaker.service.d.ts.map