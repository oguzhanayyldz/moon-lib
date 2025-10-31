"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpMetrics = void 0;
exports.httpMetricsMiddleware = httpMetricsMiddleware;
const prom_client_1 = require("prom-client");
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
class HttpMetrics {
    /**
     * Returns the Prometheus registry containing all HTTP metrics
     */
    static getRegistry() {
        return HttpMetrics.registry;
    }
    /**
     * Clears all HTTP metric values and resets the registry
     * Should NOT be used in production code.
     */
    static reset() {
        HttpMetrics.httpRequestsTotal.reset();
        HttpMetrics.httpRequestDuration.reset();
        HttpMetrics.registry.clear();
        HttpMetrics.registry.registerMetric(HttpMetrics.httpRequestsTotal);
        HttpMetrics.registry.registerMetric(HttpMetrics.httpRequestDuration);
    }
}
exports.HttpMetrics = HttpMetrics;
HttpMetrics.registry = new prom_client_1.Registry();
/**
 * Total HTTP requests counter
 *
 * Tracks total number of HTTP requests per service, method, route, and status code.
 * Labels: service, method, route, status_code
 */
HttpMetrics.httpRequestsTotal = new prom_client_1.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['service', 'method', 'route', 'status_code'],
    registers: [HttpMetrics.registry]
});
/**
 * HTTP request duration histogram
 *
 * Tracks HTTP request duration in seconds with percentile buckets.
 * Labels: service, method, route, status_code
 * Buckets: 10ms -> 30s (optimized for API response times)
 */
HttpMetrics.httpRequestDuration = new prom_client_1.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['service', 'method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5, 10, 30], // 10ms -> 30s
    registers: [HttpMetrics.registry]
});
/**
 * Extract route pattern from Express request
 *
 * Converts actual request path to route pattern for consistent metric labels.
 * Example: /api/products/123 -> /api/products/:id
 */
function extractRoute(req) {
    // Use Express route if available
    if (req.route && req.route.path) {
        const baseUrl = req.baseUrl || '';
        return `${baseUrl}${req.route.path}`;
    }
    // Fallback to actual path (less ideal for metrics)
    // Replace UUID/ID patterns to prevent high cardinality
    return req.path
        .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id') // UUID
        .replace(/\/[0-9]+/g, '/:id') // Numeric IDs
        .replace(/\/[0-9a-f]{24}/gi, '/:id'); // MongoDB ObjectId
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
function httpMetricsMiddleware(serviceName) {
    return (req, res, next) => {
        // Start timer
        const start = Date.now();
        // Capture response finish event
        res.on('finish', () => {
            // Calculate duration in seconds
            const duration = (Date.now() - start) / 1000;
            // Extract route pattern
            const route = extractRoute(req);
            // Common labels
            const labels = {
                service: serviceName,
                method: req.method,
                route,
                status_code: res.statusCode.toString()
            };
            // Record metrics
            HttpMetrics.httpRequestsTotal.inc(labels);
            HttpMetrics.httpRequestDuration.observe(labels, duration);
        });
        next();
    };
}
//# sourceMappingURL=httpMetrics.js.map