"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseApiClient = void 0;
const axios_1 = __importDefault(require("axios"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
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
    get(url, config) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.makeRequest(Object.assign(Object.assign({}, config), { method: 'GET', url }));
        });
    }
    post(url, data, config) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.makeRequest(Object.assign(Object.assign({}, config), { method: 'POST', url, data }));
        });
    }
    put(url, data, config) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.makeRequest(Object.assign(Object.assign({}, config), { method: 'PUT', url, data }));
        });
    }
    delete(url, config) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.makeRequest(Object.assign(Object.assign({}, config), { method: 'DELETE', url }));
        });
    }
    // GraphQL support method - can be overridden by child classes
    graphql(query, variables, config) {
        return __awaiter(this, void 0, void 0, function* () {
            // Use custom GraphQL endpoint if implemented by child class
            const graphqlEndpoint = this.getGraphQLEndpoint ? this.getGraphQLEndpoint() : '/graphql';
            const response = yield this.makeRequest(Object.assign(Object.assign({}, config), { method: 'POST', url: graphqlEndpoint, data: { query, variables } }));
            // Handle GraphQL-specific response structure and errors
            return this.processGraphQLResponse(response, query);
        });
    }
    // Process GraphQL response - handles both standard HTTP response and GraphQL-specific structure
    processGraphQLResponse(response, query) {
        // Null/undefined response check - enhanced safety
        if (response === null || response === undefined) {
            const errorMsg = 'GraphQL API returned null or undefined response';
            logger_service_1.logger.error(errorMsg, {
                query: (query === null || query === void 0 ? void 0 : query.substring(0, 100)) + '...',
                integrationName: this.integrationName,
                receivedResponse: response
            });
            throw new Error(errorMsg);
        }
        // Apply response processing pipeline if configured
        const processedResponse = this.applyResponseProcessing(response, { isGraphQL: true, query });
        // Null/undefined after processing check
        if (processedResponse === null || processedResponse === undefined) {
            const errorMsg = 'GraphQL response became null/undefined after processing';
            logger_service_1.logger.error(errorMsg, {
                query: (query === null || query === void 0 ? void 0 : query.substring(0, 100)) + '...',
                integrationName: this.integrationName,
                originalResponse: response,
                processedResponse
            });
            throw new Error(errorMsg);
        }
        // Check for GraphQL errors first
        if (processedResponse.errors && Array.isArray(processedResponse.errors)) {
            const errorMessage = processedResponse.errors.map((err) => err.message || err).join(', ');
            logger_service_1.logger.error('GraphQL Response Errors', {
                errors: processedResponse.errors,
                query: (query === null || query === void 0 ? void 0 : query.substring(0, 100)) + '...',
                integrationName: this.integrationName
            });
            throw new Error(`GraphQL errors: ${errorMessage}`);
        }
        // Handle different GraphQL response structures
        if (typeof processedResponse === 'object') {
            // Standard GraphQL response structure: { data: {...}, errors?: [...] }
            if (processedResponse.data !== undefined) {
                return processedResponse.data;
            }
            // Direct response (some GraphQL APIs might return data directly)
            return processedResponse;
        }
        // Invalid response type
        const errorMsg = `GraphQL response is not an object: ${typeof processedResponse}`;
        logger_service_1.logger.error(errorMsg, {
            query: (query === null || query === void 0 ? void 0 : query.substring(0, 100)) + '...',
            integrationName: this.integrationName,
            responseType: typeof processedResponse,
            response: processedResponse
        });
        throw new Error(errorMsg);
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
        // Enhanced with null/undefined safety checks to prevent errors when API times out
        if (processingConfig.autoExtractData && processedResponse !== null && processedResponse !== undefined && typeof processedResponse === 'object') {
            // Check for common nested structures
            // Use optional chaining to prevent "Cannot read properties of undefined" errors
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
    makeRequest(requestConfig) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            const startTime = Date.now();
            let logId;
            // Merge default headers with request headers
            const finalConfig = Object.assign(Object.assign({}, requestConfig), { headers: Object.assign(Object.assign({}, this.getDefaultHeaders()), requestConfig.headers) });
            // Enhanced request logging
            logger_service_1.logger.debug('Making API request', {
                method: (_a = finalConfig.method) === null || _a === void 0 ? void 0 : _a.toUpperCase(),
                url: finalConfig.url,
                hasRateLimit: !finalConfig.skipRateLimit,
                hasCircuitBreaker: !finalConfig.skipCircuitBreaker,
                hasLogRequest: finalConfig.logRequest !== false,
                integrationName: this.integrationName
            });
            try {
                // Rate limiting check (unless skipped)
                if (!finalConfig.skipRateLimit) {
                    yield this.checkRateLimit(finalConfig);
                }
                // Add request to queue and execute with circuit breaker
                const response = yield this.queue.add(() => __awaiter(this, void 0, void 0, function* () {
                    if (!finalConfig.skipCircuitBreaker) {
                        return this.circuitBreaker.execute(() => this.executeRequest(finalConfig));
                    }
                    else {
                        return this.executeRequest(finalConfig);
                    }
                }));
                // Log successful request
                if (finalConfig.logRequest !== false && this.logService) {
                    const duration = Date.now() - startTime;
                    try {
                        logId = yield this.logRequest(finalConfig);
                        yield this.logResponse(logId, {
                            responseStatus: (response === null || response === void 0 ? void 0 : response.status) || 0,
                            responseHeaders: response === null || response === void 0 ? void 0 : response.headers,
                            responseBody: response === null || response === void 0 ? void 0 : response.data,
                            duration
                        });
                    }
                    catch (logError) {
                        logger_service_1.logger.warn('Failed to log successful request', {
                            error: logError.message,
                            integrationName: this.integrationName
                        });
                    }
                }
                // Update metrics
                this.updateMetrics(true, Date.now() - startTime);
                logger_service_1.logger.debug('API request completed successfully', {
                    method: finalConfig.method,
                    url: finalConfig.url,
                    status: response === null || response === void 0 ? void 0 : response.status,
                    duration: Date.now() - startTime,
                    integrationName: this.integrationName
                });
                return response.data;
            }
            catch (error) {
                const duration = Date.now() - startTime;
                // Log failed request
                if (requestConfig.logRequest !== false && this.logService) {
                    try {
                        if (!logId) {
                            logId = yield this.logRequest(requestConfig);
                        }
                        // Enhanced error parsing - child classes (like ShopifyApiClient) may return structured error objects
                        let responseStatus = ((_b = error.response) === null || _b === void 0 ? void 0 : _b.status) || 500; // Default to 500 instead of 0
                        let responseBody = ((_c = error.response) === null || _c === void 0 ? void 0 : _c.data) || error.message;
                        // Try to parse enhanced error objects (JSON-stringified errors from child classes)
                        if (error.message && !(error.response)) {
                            try {
                                const parsedError = JSON.parse(error.message);
                                // Check if this is an enhanced error object with statusCode and message
                                if (parsedError && typeof parsedError === 'object' && parsedError.statusCode && parsedError.message) {
                                    responseStatus = parsedError.statusCode;
                                    // Build user-friendly error message
                                    const errorType = parsedError.type ? `[${parsedError.type}] ` : '';
                                    const errorMessage = parsedError.message;
                                    const errorDetails = parsedError.details ? ` - ${JSON.stringify(parsedError.details)}` : '';
                                    responseBody = `${errorType}${errorMessage}${errorDetails}`;
                                    logger_service_1.logger.debug('Enhanced error parsed successfully', {
                                        originalStatus: 0,
                                        parsedStatus: responseStatus,
                                        errorType: parsedError.type,
                                        integrationName: this.integrationName
                                    });
                                }
                            }
                            catch (parseError) {
                                // Not a JSON error or parsing failed - keep original values
                                logger_service_1.logger.debug('Error message is not enhanced JSON format, using original', {
                                    integrationName: this.integrationName
                                });
                            }
                        }
                        // Rate limit metadata ekle (429 hatası için)
                        let metadata;
                        if (responseStatus === 429) {
                            const headers = ((_d = error.response) === null || _d === void 0 ? void 0 : _d.headers) || {};
                            metadata = {
                                rateLimitExceeded: true,
                                limit: headers['x-ratelimit-limit'],
                                remaining: headers['x-ratelimit-remaining'],
                                resetTime: headers['x-ratelimit-reset'],
                                retryAfter: headers['x-ratelimit-retryafter'] || (responseBody === null || responseBody === void 0 ? void 0 : responseBody.retryAfter)
                            };
                            logger_service_1.logger.warn('Rate limit exceeded, metadata added to log', {
                                metadata,
                                integrationName: this.integrationName,
                                endpoint: requestConfig.url
                            });
                        }
                        yield this.logResponse(logId, {
                            responseStatus,
                            responseHeaders: (_e = error.response) === null || _e === void 0 ? void 0 : _e.headers,
                            responseBody,
                            duration,
                            metadata
                        });
                    }
                    catch (logError) {
                        logger_service_1.logger.warn('Failed to log failed request', {
                            error: logError.message,
                            integrationName: this.integrationName
                        });
                    }
                }
                // Update metrics
                this.updateMetrics(false, duration);
                // Handle custom error processing
                if (this.handleCustomError) {
                    try {
                        this.handleCustomError(error);
                    }
                    catch (customErrorHandlingError) {
                        logger_service_1.logger.warn('Custom error handler failed', {
                            error: customErrorHandlingError.message,
                            integrationName: this.integrationName
                        });
                    }
                }
                logger_service_1.logger.error('API request failed', {
                    method: requestConfig.method,
                    url: requestConfig.url,
                    status: (_f = error.response) === null || _f === void 0 ? void 0 : _f.status,
                    errorMessage: error.message,
                    duration,
                    integrationName: this.integrationName
                });
                throw error;
            }
        });
    }
    executeRequest(requestConfig) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
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
                    const response = yield this.httpClient.request(requestConfig);
                    if (span) {
                        if (response === null || response === void 0 ? void 0 : response.status) {
                            span.setTag('http.status_code', response.status);
                        }
                        span.finish();
                    }
                    return response;
                }
                catch (error) {
                    lastError = error;
                    // Enhanced error logging with defensive checks
                    logger_service_1.logger.error('Request execution error', {
                        hasResponse: !!lastError.response,
                        status: (_c = lastError.response) === null || _c === void 0 ? void 0 : _c.status,
                        statusText: (_d = lastError.response) === null || _d === void 0 ? void 0 : _d.statusText,
                        code: lastError.code,
                        message: lastError.message,
                        method: requestConfig.method,
                        url: requestConfig.url,
                        integrationName: this.integrationName,
                        retryCount,
                        maxRetries: (retryConfig === null || retryConfig === void 0 ? void 0 : retryConfig.maxRetries) || 0
                    });
                    // Handle rate limit errors specifically
                    if (((_e = lastError.response) === null || _e === void 0 ? void 0 : _e.status) === 429) {
                        logger_service_1.logger.warn('Rate limit detected (429), calling handleRateLimitError', {
                            integrationName: this.integrationName,
                            retryCount,
                            maxRetries: retryConfig === null || retryConfig === void 0 ? void 0 : retryConfig.maxRetries
                        });
                        try {
                            yield this.handleRateLimitError(lastError);
                        }
                        catch (rateLimitError) {
                            logger_service_1.logger.error('handleRateLimitError failed', {
                                error: rateLimitError.message,
                                integrationName: this.integrationName
                            });
                        }
                    }
                    // Check if this error should be retried
                    if (retryCount < ((retryConfig === null || retryConfig === void 0 ? void 0 : retryConfig.maxRetries) || 0) && this.shouldRetry(lastError)) {
                        retryCount++;
                        const delay = this.calculateRetryDelay(retryCount, retryConfig);
                        logger_service_1.logger.info(`Retrying request (attempt ${retryCount}/${retryConfig === null || retryConfig === void 0 ? void 0 : retryConfig.maxRetries}) after ${delay}ms`, {
                            method: requestConfig.method,
                            url: requestConfig.url,
                            error: lastError.message,
                            integrationName: this.integrationName
                        });
                        yield this.sleep(delay);
                        continue;
                    }
                    throw lastError;
                }
            }
            throw lastError;
        });
    }
    checkRateLimit(requestConfig) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = this.config.userId || 'default';
                yield this.rateLimiter.consume(userId, 1);
            }
            catch (rateLimiterResponse) {
                const msBeforeNext = rateLimiterResponse.msBeforeNext || 5000;
                logger_service_1.logger.warn('Rate limit exceeded, waiting before retry', {
                    userId: this.config.userId,
                    waitTime: msBeforeNext,
                    url: requestConfig.url
                });
                yield this.sleep(msBeforeNext);
                throw new api_client_types_1.RateLimitExceededError(msBeforeNext);
            }
        });
    }
    calculateRetryDelay(retryCount, retryConfig) {
        if (!retryConfig)
            return 1000;
        const exponentialDelay = retryConfig.initialDelay * Math.pow(retryConfig.backoffFactor, retryCount - 1);
        return Math.min(exponentialDelay, retryConfig.maxDelay);
    }
    logRequest(requestConfig) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!this.logService)
                return '';
            return this.logService.logRequest({
                method: ((_a = requestConfig.method) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || 'GET',
                endpoint: this.buildFullUrl(requestConfig.url || ''),
                requestHeaders: Object.assign(Object.assign({}, this.getDefaultHeaders()), requestConfig.headers),
                requestBody: requestConfig.data,
                userId: this.config.userId || 'unknown',
                integrationName: this.integrationName,
                operationType: requestConfig.operationType // İşlem kategorisi
            });
        });
    }
    logResponse(logId, params) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.logService || !logId)
                return;
            yield this.logService.logResponse(logId, params);
        });
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
            // Initial setup with HTTP Keep-Alive agents for persistent connections
            const httpAgent = new http_1.default.Agent({
                keepAlive: true,
                keepAliveMsecs: 300000, // Keep connection alive for 5 minutes (increased from 60s for better performance)
                maxSockets: 50, // Max concurrent connections
                maxFreeSockets: 10, // Max idle connections to keep open
                timeout: 30000 // 30 second connection timeout (prevents long hangs)
            });
            const httpsAgent = new https_1.default.Agent({
                keepAlive: true,
                keepAliveMsecs: 300000, // 5 minutes Keep-Alive
                maxSockets: 50,
                maxFreeSockets: 10,
                timeout: 30000, // 30 second connection timeout
                family: 4 // Force IPv4 (prevents IPv6 DNS lookup delays)
            });
            this.httpClient = axios_1.default.create({
                baseURL: this.getBaseURL(),
                timeout: this.config.timeout,
                headers: this.getDefaultHeaders(),
                httpAgent: httpAgent,
                httpsAgent: httpsAgent
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
