import { Request, Response, NextFunction } from 'express';
import { Counter, Histogram, Registry } from 'prom-client';
/**
 * HTTP Metrics for Express Applications
 *
 * Provides Prometheus format metrics for HTTP requests.
 * Tracks request counts, duration, and response codes.
 *
 * @example
 * ```typescript
 * import { httpMetricsMiddleware } from '@xmoonx/moon-lib';
 *
 * app.use(httpMetricsMiddleware('auth'));
 * ```
 */
export declare class HttpMetrics {
    private static registry;
    /**
     * Total HTTP requests counter
     *
     * Tracks total number of HTTP requests per service, method, route, and status code.
     * Labels: service, method, route, status_code
     */
    static readonly httpRequestsTotal: Counter<"route" | "service" | "method" | "status_code">;
    /**
     * HTTP request duration histogram
     *
     * Tracks HTTP request duration in seconds with percentile buckets.
     * Labels: service, method, route, status_code
     * Buckets: 10ms -> 30s (optimized for API response times)
     */
    static readonly httpRequestDuration: Histogram<"route" | "service" | "method" | "status_code">;
    /**
     * Returns the Prometheus registry containing all HTTP metrics
     */
    static getRegistry(): Registry;
    /**
     * Clears all HTTP metric values and resets the registry
     * Should NOT be used in production code.
     */
    static reset(): void;
}
/**
 * Express middleware for HTTP metrics collection
 *
 * Records HTTP request count and duration for each request.
 * Attaches to response 'finish' event to capture final status code.
 *
 * @param serviceName - Name of the microservice (e.g., 'auth', 'products')
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { httpMetricsMiddleware } from '@xmoonx/moon-lib';
 *
 * const app = express();
 *
 * // Add metrics middleware early in middleware chain
 * app.use(httpMetricsMiddleware('auth'));
 *
 * // Your routes here
 * app.get('/api/users', (req, res) => {
 *   res.send({ users: [] });
 * });
 *
 * // Metrics will automatically be collected
 * ```
 */
export declare function httpMetricsMiddleware(serviceName: string): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=httpMetrics.d.ts.map