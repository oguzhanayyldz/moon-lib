"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseApiClient = void 0;
const axios_1 = __importDefault(require("axios"));
const rate_limiter_flexible_1 = require("rate-limiter-flexible");
const PQueue = require('p-queue').default;
const api_client_types_1 = require("../common/types/api-client.types");
const circuitBreaker_service_1 = require("./circuitBreaker.service");
const logger_service_1 = require("./logger.service");
class BaseApiClient {
    constructor(config, serviceName, integrationName, tracer, logService) {
        this.config = config;
        this.integrationName = integrationName;
        this.logService = logService;
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0
        };
        // Setup dependencies first (HTTP client will be set up later by child classes)
        this.setupRateLimiter(config.rateLimiter);
        this.setupQueue(config.queue);
        this.setupCircuitBreaker(config.circuitBreaker, serviceName);
        this.setupTracing(tracer);
        // Note: HTTP client setup is deferred to child classes via reconfigureHttpClient()
    }
    // Public API methods
    async get(url, config) {
        return this.makeRequest(Object.assign(Object.assign({}, config), { method: 'GET', url }));
    }
    async post(url, data, config) {
        return this.makeRequest(Object.assign(Object.assign({}, config), { method: 'POST', url, data }));
    }
    async put(url, data, config) {
        return this.makeRequest(Object.assign(Object.assign({}, config), { method: 'PUT', url, data }));
    }
    async delete(url, config) {
        return this.makeRequest(Object.assign(Object.assign({}, config), { method: 'DELETE', url }));
    }
    // GraphQL support method - can be overridden by child classes
    async graphql(query, variables, config) {
        // Use custom GraphQL endpoint if implemented by child class
        const graphqlEndpoint = this.getGraphQLEndpoint ? this.getGraphQLEndpoint() : '/graphql';
        const response = await this.makeRequest(Object.assign(Object.assign({}, config), { method: 'POST', url: graphqlEndpoint, data: { query, variables } }));
        // Handle GraphQL-specific response structure and errors
        return this.processGraphQLResponse(response, query);
    }
    // Process GraphQL response - handles both standard HTTP response and GraphQL-specific structure
    processGraphQLResponse(response, query) {
        // Apply response processing pipeline if configured
        const processedResponse = this.applyResponseProcessing(response, { isGraphQL: true, query });
        // Check for GraphQL errors first
        if (processedResponse && processedResponse.errors && Array.isArray(processedResponse.errors)) {
            const errorMessage = processedResponse.errors.map((err) => err.message || err).join(', ');
            logger_service_1.logger.error('GraphQL Response Errors', {
                errors: processedResponse.errors,
                query: (query === null || query === void 0 ? void 0 : query.substring(0, 100)) + '...',
                integrationName: this.integrationName
            });
            throw new Error(`GraphQL errors: ${errorMessage}`);
        }
        // Handle different GraphQL response structures
        if (processedResponse && typeof processedResponse === 'object') {
            // Standard GraphQL response structure: { data: {...}, errors?: [...] }
            if (processedResponse.data !== undefined) {
                return processedResponse.data;
            }
            // Direct response (some GraphQL APIs might return data directly)
            return processedResponse;
        }
        // Fallback - return as-is
        return processedResponse;
    }
    // Apply response processing pipeline
    applyResponseProcessing(response, context = {}) {
        const processingConfig = this.config.responseProcessing;
        // If no processing config, return as-is
        if (!processingConfig) {
            return response;
        }
        let processedResponse = response;
        // Apply custom processors if configured
        if (processingConfig.customProcessors) {
            for (const processor of processingConfig.customProcessors) {
                if (processor.condition(processedResponse, context)) {
                    logger_service_1.logger.debug(`Applying response processor: ${processor.name}`, {
                        integrationName: this.integrationName,
                        context
                    });
                    processedResponse = processor.process(processedResponse, context);
                }
            }
        }
        // Auto-extract data if enabled (for nested API responses)
        if (processingConfig.autoExtractData && processedResponse && typeof processedResponse === 'object') {
            // Check for common nested structures
            if (processedResponse.data !== undefined && !context.isGraphQL) {
                logger_service_1.logger.debug('Auto-extracting data from nested response', {
                    integrationName: this.integrationName,
                    hasData: !!processedResponse.data
                });
                processedResponse = processedResponse.data;
            }
        }
        return processedResponse;
    }
    // Core request method
    async makeRequest(requestConfig) {
        var _a, _b, _c;
        const startTime = Date.now();
        let logId;
        // Merge default headers with request headers
        const finalConfig = Object.assign(Object.assign({}, requestConfig), { headers: Object.assign(Object.assign({}, this.getDefaultHeaders()), requestConfig.headers) });
        try {
            // Rate limiting check (unless skipped)
            if (!finalConfig.skipRateLimit) {
                await this.checkRateLimit(finalConfig);
            }
            // Add request to queue and execute with circuit breaker
            const response = await this.queue.add(async () => {
                if (!finalConfig.skipCircuitBreaker) {
                    return this.circuitBreaker.execute(() => this.executeRequest(finalConfig));
                }
                else {
                    return this.executeRequest(finalConfig);
                }
            });
            // Log successful request
            if (finalConfig.logRequest !== false && this.logService) {
                const duration = Date.now() - startTime;
                logId = await this.logRequest(finalConfig);
                await this.logResponse(logId, {
                    status: response.status,
                    headers: response.headers,
                    body: response.data,
                    duration
                });
            }
            // Update metrics
            this.updateMetrics(true, Date.now() - startTime);
            return response.data;
        }
        catch (error) {
            // Log failed request
            if (requestConfig.logRequest !== false && this.logService) {
                const duration = Date.now() - startTime;
                if (!logId) {
                    logId = await this.logRequest(requestConfig);
                }
                await this.logResponse(logId, {
                    status: ((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) || 0,
                    headers: (_b = error.response) === null || _b === void 0 ? void 0 : _b.headers,
                    body: ((_c = error.response) === null || _c === void 0 ? void 0 : _c.data) || error.message,
                    duration
                });
            }
            // Update metrics
            this.updateMetrics(false, Date.now() - startTime);
            // Handle custom error processing
            if (this.handleCustomError) {
                this.handleCustomError(error);
            }
            throw error;
        }
    }
    async executeRequest(requestConfig) {
        var _a, _b;
        let lastError;
        const retryConfig = this.config.retries;
        let retryCount = 0;
        while (retryCount <= ((retryConfig === null || retryConfig === void 0 ? void 0 : retryConfig.maxRetries) || 0)) {
            try {
                const span = (_a = this.tracer) === null || _a === void 0 ? void 0 : _a.startSpan(`api-request-${(_b = requestConfig.method) === null || _b === void 0 ? void 0 : _b.toLowerCase()}`);
                if (span) {
                    span.setTag('http.method', requestConfig.method);
                    span.setTag('http.url', requestConfig.url);
                }
                const response = await this.httpClient.request(requestConfig);
                if (span) {
                    span.setTag('http.status_code', response.status);
                    span.finish();
                }
                return response;
            }
            catch (error) {
                lastError = error;
                // Check if this error should be retried
                if (retryCount < ((retryConfig === null || retryConfig === void 0 ? void 0 : retryConfig.maxRetries) || 0) && this.shouldRetry(lastError)) {
                    retryCount++;
                    const delay = this.calculateRetryDelay(retryCount, retryConfig);
                    logger_service_1.logger.info(`Retrying request (attempt ${retryCount}/${retryConfig === null || retryConfig === void 0 ? void 0 : retryConfig.maxRetries}) after ${delay}ms`, {
                        method: requestConfig.method,
                        url: requestConfig.url,
                        error: lastError.message
                    });
                    await this.sleep(delay);
                    continue;
                }
                throw lastError;
            }
        }
        throw lastError;
    }
    async checkRateLimit(requestConfig) {
        try {
            const userId = this.config.userId || 'default';
            await this.rateLimiter.consume(userId, 1);
        }
        catch (rateLimiterResponse) {
            const msBeforeNext = rateLimiterResponse.msBeforeNext || 5000;
            logger_service_1.logger.warn('Rate limit exceeded, waiting before retry', {
                userId: this.config.userId,
                waitTime: msBeforeNext,
                url: requestConfig.url
            });
            await this.sleep(msBeforeNext);
            throw new api_client_types_1.RateLimitExceededError(msBeforeNext);
        }
    }
    calculateRetryDelay(retryCount, retryConfig) {
        if (!retryConfig)
            return 1000;
        const exponentialDelay = retryConfig.initialDelay * Math.pow(retryConfig.backoffFactor, retryCount - 1);
        return Math.min(exponentialDelay, retryConfig.maxDelay);
    }
    async logRequest(requestConfig) {
        var _a;
        if (!this.logService)
            return '';
        return this.logService.logRequest({
            method: ((_a = requestConfig.method) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || 'GET',
            endpoint: this.buildFullUrl(requestConfig.url || ''),
            requestHeaders: Object.assign(Object.assign({}, this.getDefaultHeaders()), requestConfig.headers),
            requestBody: requestConfig.data,
            userId: this.config.userId || 'unknown',
            integrationName: this.integrationName
        });
    }
    async logResponse(logId, params) {
        if (!this.logService || !logId)
            return;
        await this.logService.logResponse(logId, params);
    }
    buildFullUrl(url) {
        if (url.startsWith('http'))
            return url;
        const baseURL = this.getBaseURL();
        const fullUrl = `${baseURL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
        logger_service_1.logger.debug('Building full URL', {
            baseURL,
            url,
            fullUrl,
            integrationName: this.integrationName
        });
        return fullUrl;
    }
    updateMetrics(success, responseTime) {
        this.metrics.totalRequests++;
        this.metrics.lastRequestTime = Date.now();
        if (success) {
            this.metrics.successfulRequests++;
        }
        else {
            this.metrics.failedRequests++;
        }
        // Update average response time
        const totalSuccessTime = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1);
        this.metrics.averageResponseTime = (totalSuccessTime + responseTime) / this.metrics.totalRequests;
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    // Setup methods
    setupHttpClient(config) {
        this.httpClient = axios_1.default.create({
            baseURL: this.getBaseURL(),
            timeout: config.timeout,
            headers: this.getDefaultHeaders()
        });
    }
    // Allow child classes to initialize HTTP client after properties are set
    reconfigureHttpClient() {
        if (!this.httpClient) {
            // Initial setup
            this.httpClient = axios_1.default.create({
                baseURL: this.getBaseURL(),
                timeout: this.config.timeout,
                headers: this.getDefaultHeaders()
            });
            this.setupInterceptors();
            logger_service_1.logger.debug('HTTP client initialized', {
                baseURL: this.httpClient.defaults.baseURL,
                integrationName: this.integrationName
            });
        }
        else {
            // Reconfiguration
            this.httpClient.defaults.baseURL = this.getBaseURL();
            this.httpClient.defaults.headers.common = Object.assign(Object.assign({}, this.httpClient.defaults.headers.common), this.getDefaultHeaders());
            logger_service_1.logger.debug('HTTP client reconfigured', {
                baseURL: this.httpClient.defaults.baseURL,
                integrationName: this.integrationName
            });
        }
    }
    setupRateLimiter(config) {
        this.rateLimiter = new rate_limiter_flexible_1.RateLimiterMemory({
            points: config.points,
            duration: config.duration,
            blockDuration: config.blockDuration || config.duration
        });
    }
    setupQueue(config) {
        this.queue = new PQueue({
            concurrency: config.concurrency,
            intervalCap: config.intervalCap,
            interval: config.interval,
            timeout: config.timeout,
            carryoverConcurrencyCount: config.carryoverConcurrencyCount
        });
    }
    setupCircuitBreaker(config, serviceName) {
        this.circuitBreaker = new circuitBreaker_service_1.CircuitBreaker(config, serviceName);
    }
    // setupLogging method artık gerekli değil - constructor'da inject ediliyor
    setupTracing(tracer) {
        try {
            this.tracer = tracer;
        }
        catch (error) {
            logger_service_1.logger.warn('Failed to initialize tracing', { error: error.message });
        }
    }
    setupInterceptors() {
        // Request interceptor
        this.httpClient.interceptors.request.use((config) => {
            var _a, _b, _c;
            logger_service_1.logger.debug('HTTP Request', {
                method: (_a = config.method) === null || _a === void 0 ? void 0 : _a.toUpperCase(),
                url: config.url,
                baseURL: config.baseURL,
                fullURL: config.baseURL ? `${config.baseURL}${config.url}` : config.url,
                headers: {
                    'Content-Type': (_b = config.headers) === null || _b === void 0 ? void 0 : _b['Content-Type'],
                    'X-Shopify-Access-Token': ((_c = config.headers) === null || _c === void 0 ? void 0 : _c['X-Shopify-Access-Token']) ? '[REDACTED]' : undefined
                }
            });
            return config;
        }, (error) => {
            logger_service_1.logger.error('HTTP Request Error', { error: error.message });
            return Promise.reject(error);
        });
        // Response interceptor
        this.httpClient.interceptors.response.use((response) => {
            logger_service_1.logger.debug('HTTP Response', {
                status: response.status,
                url: response.config.url,
                dataExists: !!response.data
            });
            return response;
        }, (error) => {
            var _a, _b;
            logger_service_1.logger.error('HTTP Response Error', {
                status: (_a = error.response) === null || _a === void 0 ? void 0 : _a.status,
                url: (_b = error.config) === null || _b === void 0 ? void 0 : _b.url,
                error: error.message
            });
            return Promise.reject(error);
        });
    }
    // Public utility methods
    getMetrics() {
        return Object.assign({}, this.metrics);
    }
    getCircuitBreakerMetrics() {
        return this.circuitBreaker.getMetrics();
    }
    resetCircuitBreaker() {
        this.circuitBreaker.reset();
    }
}
exports.BaseApiClient = BaseApiClient;
//# sourceMappingURL=baseApiClient.service.js.map