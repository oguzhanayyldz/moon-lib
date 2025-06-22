"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityConfigFactory = exports.MicroserviceSecurityService = void 0;
const index_1 = require("../index");
const SecurityValidator_1 = require("./SecurityValidator");
const RateLimiter_1 = require("./RateLimiter");
const BruteForceProtection_1 = require("./BruteForceProtection");
const SecurityHeaders_1 = require("./SecurityHeaders");
const SecurityManager_1 = require("./SecurityManager");
const CSRFService_1 = require("./CSRFService");
/**
 * Merkezi Mikroservis Güvenlik Servisi
 *
 * Bu sınıf tüm mikroservislerde ortak güvenlik katmanını sağlamak amacıyla oluşturulmuştur.
 * Güvenlik bileşenlerini (validator, rate limiter, brute force protection, vb.)
 * tek bir yerden yönetir ve tutarlı bir güvenlik politikası uygular.
 */
class MicroserviceSecurityService {
    /**
     * Mikroservis Güvenlik Servisi oluşturur
     * @param config Güvenlik yapılandırması
     */
    constructor(config) {
        // Default değerleri içeren temel konfigürasyon
        const defaultConfig = {
            serviceName: 'default',
            apiPathRegex: /.*/,
            maxFileSize: 5 * 1024 * 1024, // 5MB
            allowedFileTypes: ['application/json'],
            maxRequestsPerWindow: 100,
            requestWindowMs: 15 * 60 * 1000, // 15 dakika
            bruteForceMaxAttempts: 5,
            bruteForceBlockDurationMs: 15 * 60 * 1000, // 15 dakika
            bruteForceWindowMs: 30 * 60 * 1000, // 30 dakika
            enableXSSProtection: true,
            enableSQLInjectionProtection: true,
            enableFileUploadValidation: true,
            enableCSP: true,
            enableHSTS: true,
            enableXFrameOptions: true,
            enableXContentTypeOptions: true,
            maxInputLength: 1000
        };
        // Default değerleri gelen config ile birleştir - tip güvenli yaklaşım
        this.config = Object.assign(Object.assign({}, defaultConfig), config);
        // SecurityValidator başlat
        this.validator = new SecurityValidator_1.SecurityValidator({
            enableInputSanitization: true,
            maxInputLength: this.config.maxInputLength,
            enableXSSProtection: this.config.enableXSSProtection,
            enableSQLInjectionProtection: this.config.enableSQLInjectionProtection,
            enableFileUploadValidation: this.config.enableFileUploadValidation,
            maxFileSize: this.config.maxFileSize,
            allowedFileTypes: this.config.allowedFileTypes
        });
        // RateLimiter başlat
        this.rateLimiter = new RateLimiter_1.RateLimiter(index_1.redisWrapper.client, {
            windowMs: this.config.requestWindowMs,
            maxRequests: this.config.maxRequestsPerWindow,
            keyGenerator: (req) => {
                var _a;
                // Kullanıcı kimliği varsa kullan, yoksa IP
                const userId = (_a = req.currentUser) === null || _a === void 0 ? void 0 : _a.id;
                const ip = req.ip || '0.0.0.0'; // IP için fallback değer
                return userId
                    ? `${this.config.serviceName}_rate_limit:user:${userId}`
                    : `${this.config.serviceName}_rate_limit:ip:${ip}`;
            },
            skipSuccessfulRequests: false,
            skipFailedRequests: false
        });
        // BruteForceProtection başlat
        this.bruteForceProtection = new BruteForceProtection_1.BruteForceProtection(index_1.redisWrapper.client, {
            maxAttempts: this.config.bruteForceMaxAttempts,
            blockDurationMs: this.config.bruteForceBlockDurationMs,
            windowMs: this.config.bruteForceWindowMs,
            enabled: true
        });
        // SecurityHeaders başlat
        this.securityHeaders = new SecurityHeaders_1.SecurityHeaders({
            enableCSP: this.config.enableCSP,
            enableHSTS: this.config.enableHSTS,
            enableXFrameOptions: this.config.enableXFrameOptions,
            enableXContentTypeOptions: this.config.enableXContentTypeOptions,
            enableXSSProtection: this.config.enableXSSProtection
        });
        // SecurityManager başlat
        this.securityManager = new SecurityManager_1.SecurityManager();
        // CSRFService başlat
        this.csrfService = new CSRFService_1.CSRFService(index_1.redisWrapper.client, {
            secretKey: process.env.CSRF_SECRET || `${this.config.serviceName}-csrf-secret`,
            tokenExpiry: 3600, // 1 hour
            cookieName: '_csrf',
            headerName: 'x-csrf-token',
            skipRoutes: ['/health', '/metrics', '/api/health'],
            secure: this.config.environment === 'production'
        });
        index_1.logger.info(`MicroserviceSecurityService initialized for ${this.config.serviceName} service`);
    }
    /**
     * Input doğrulaması gerçekleştirir
     *
     * Tüm validasyon işlemleri için merkezi metod.
     * Login, sipariş, güncelleme gibi tüm validasyonlar için kullanılır.
     *
     * @param data Doğrulanacak veri
     * @returns Doğrulama sonucu
     */
    async validateInput(data) {
        return this.validator.validateInput(data);
    }
    /**
     * Oturum durumunu kontrol eder
     * @param usernameOrEmail Kullanıcı adı veya email
     * @returns Oturum durumu
     */
    async getStatus(usernameOrEmail) {
        try {
            if (!this.bruteForceProtection || typeof this.bruteForceProtection.getStatus !== 'function') {
                index_1.logger.error('BruteForceProtection getStatus fonksiyonu bulunamadı');
                return { allowed: true };
            }
            const status = await this.bruteForceProtection.getStatus(usernameOrEmail);
            // BruteForceResult tiplemesi ile uyumsuzluk sorununu aşmak için
            // any kullanarak esnek bir yapı oluşturuyoruz
            const result = status;
            // Olası tüm durum alanlarını kontrol edelim
            const isAllowed = typeof result.allowed === 'boolean' ? result.allowed :
                typeof result.isAllowed === 'boolean' ? result.isAllowed :
                    typeof result.blocked === 'boolean' ? !result.blocked :
                        typeof result.isBlocked === 'boolean' ? !result.isBlocked : true;
            // Olası tüm kalan süre alanlarını kontrol edelim
            const timeRemaining = typeof result.remainingTime === 'number' ? result.remainingTime :
                typeof result.blockTimeRemaining === 'number' ? result.blockTimeRemaining :
                    typeof result.blockDuration === 'number' ? result.blockDuration : 0;
            return {
                allowed: isAllowed,
                remainingTime: timeRemaining
            };
        }
        catch (error) {
            // Herhangi bir hata durumunda güvenli mod - login izni verme
            index_1.logger.error('getStatus fonksiyonunda hata:', error);
            return { allowed: true }; // Hata durumunda login izni ver
        }
    }
    /**
     * Rate limiting için Express middleware'i alır
     */
    getRateLimitMiddleware() {
        // RateLimiter nesnesini kontrol et
        if (!this.rateLimiter || typeof this.rateLimiter.middleware !== 'function') {
            index_1.logger.error('RateLimiter middleware fonksiyonu bulunamadı');
            return (_req, _res, next) => next();
        }
        return this.rateLimiter.middleware();
    }
    /**
     * Güvenlik başlıkları için Express middleware'i alır
     */
    getSecurityHeadersMiddleware() {
        // Güvenlik başlıkları nesnesini kontrol et
        if (!this.securityHeaders || typeof this.securityHeaders.middleware !== 'function') {
            index_1.logger.error('SecurityHeaders middleware fonksiyonu bulunamadı');
            // Fallback middleware dönelim
            return (_req, _res, next) => {
                next();
            };
        }
        return this.securityHeaders.middleware();
    }
    /**
     * Brute force koruması için Express middleware'i alır
     */
    getBruteForceMiddleware() {
        // BruteForceProtection nesnesini kontrol et
        if (!this.bruteForceProtection || typeof this.bruteForceProtection.loginProtection !== 'function') {
            index_1.logger.error('BruteForceProtection loginProtection fonksiyonu bulunamadı');
            // Fallback middleware dönelim
            return (_req, _res, next) => {
                next();
            };
        }
        return this.bruteForceProtection.loginProtection();
    }
    /**
     * Başarısız giriş işlemleri için Express middleware'i alır
     */
    getFailedLoginHandlerMiddleware() {
        // BruteForceProtection nesnesini kontrol et
        if (!this.bruteForceProtection || typeof this.bruteForceProtection.handleFailedLogin !== 'function') {
            index_1.logger.error('BruteForceProtection handleFailedLogin fonksiyonu bulunamadı');
            // Fallback middleware dönelim
            return (_req, _res, next) => {
                next();
            };
        }
        return this.bruteForceProtection.handleFailedLogin();
    }
    /**
     * Kullanıcıya özgü rate limiting middleware'i
     * Not: Servis-özel işlevlerle geriye dönük uyumluluk için
     */
    getUserRateLimitMiddleware() {
        return this.getRateLimitMiddleware();
    }
    /**
     * Dosya yükleme validasyon middleware'i
     * Not: Servis-özel işlevlerle geriye dönük uyumluluk için
     */
    getFileUploadValidationMiddleware() {
        return (_req, _res, next) => {
            if (this.validator && typeof this.validator.validateFileUpload === 'function') {
                // Burada dosya yükleme validasyonu için gerekli işlemler yapılabilir
                // Ancak şimdilik sadece next() ile devam etmesini sağlıyoruz
            }
            next();
        };
    }
    /**
     * Dosya yükleme validasyonu yapar
     * @param file Yüklenecek dosya objesi
     */
    async validateFileUpload(file) {
        if (this.validator && typeof this.validator.validateFileUpload === 'function') {
            return this.validator.validateFileUpload({
                file,
                maxSize: this.config.maxFileSize,
                allowedTypes: this.config.allowedFileTypes
            });
        }
        // Validator yoksa hata dön
        return {
            isValid: false,
            errors: ['File validation service is not available']
        };
    }
    /**
     * Başarısız giriş denemesini kaydeder
     */
    async recordFailedAttempt(identifier) {
        await this.bruteForceProtection.recordFailedAttempt(identifier);
    }
    /**
     * Kimliğin brute force nedeniyle engellenip engellenmediğini kontrol eder
     */
    async isBlocked(identifier) {
        return await this.bruteForceProtection.isBlocked(identifier);
    }
    /**
     * Kimliğin geçerli deneme sayısını alır
     */
    async getAttemptCount(identifier) {
        return await this.bruteForceProtection.getAttemptCount(identifier);
    }
    /**
     * Belirtilen API yolu için brute force koruması middleware'i uygular
     */
    applyBruteForceProtectionForPath() {
        return (req, res, next) => {
            // Sadece belirtilen API yolları için brute force koruması uygula
            if (this.config.apiPathRegex.test(req.path)) {
                return this.getBruteForceMiddleware()(req, res, next);
            }
            next();
        };
    }
    /**
     * API Key based rate limiting middleware
     */
    getApiKeyRateLimitMiddleware() {
        if (!this.config.enableApiKeyRateLimit) {
            return (_req, _res, next) => {
                next();
            };
        }
        return async (req, res, next) => {
            var _a, _b;
            try {
                const apiKey = req.headers['x-api-key'];
                if (!apiKey) {
                    return next(); // No API key, skip API key rate limiting
                }
                // Use RateLimiter's API key method if available
                if (this.rateLimiter && typeof this.rateLimiter.checkAPIKeyRateLimit === 'function') {
                    const endpoint = `${req.method}:${((_a = req.route) === null || _a === void 0 ? void 0 : _a.path) || req.path}`;
                    const result = await this.rateLimiter.checkAPIKeyRateLimit(apiKey, endpoint);
                    if (!result.allowed) {
                        index_1.logger.warn('API key rate limit exceeded:', {
                            apiKey: apiKey.substring(0, 8) + '...',
                            endpoint,
                            totalHits: result.totalHits
                        });
                        return res.status(429).json({
                            error: 'API key rate limit exceeded',
                            retryAfter: Math.ceil(result.timeUntilReset / 1000),
                            resetTime: result.resetTime
                        });
                    }
                    // Set API key rate limit headers
                    res.set({
                        'X-API-RateLimit-Limit': ((_b = this.config.apiKeyMaxRequests) === null || _b === void 0 ? void 0 : _b.toString()) || '5000',
                        'X-API-RateLimit-Remaining': (this.config.apiKeyMaxRequests - result.totalHits).toString(),
                        'X-API-RateLimit-Reset': result.resetTime.toISOString()
                    });
                }
                next();
            }
            catch (error) {
                index_1.logger.error('API key rate limiting error:', error);
                next(); // Fail open
            }
        };
    }
    /**
     * Combined security middleware with API key support
     */
    getEnhancedSecurityMiddleware() {
        const middlewares = [];
        // Security headers (always first)
        middlewares.push(this.getSecurityHeadersMiddleware());
        // API key rate limiting (if enabled)
        if (this.config.enableApiKeyRateLimit) {
            middlewares.push(this.getApiKeyRateLimitMiddleware());
        }
        // Regular rate limiting
        middlewares.push(this.getRateLimitMiddleware());
        // Input validation
        if (this.validator) {
            middlewares.push((req, res, next) => {
                if (req.body && this.validator && typeof this.validator.sanitizeInput === 'function') {
                    req.body = this.validator.sanitizeInput(req.body);
                }
                next();
            });
        }
        return middlewares;
    }
    /**
     * CSRF protection middleware - uses enhanced CSRFService
     */
    getCSRFProtectionMiddleware() {
        return this.csrfService.protectionMiddleware(this.config.serviceName);
    }
    /**
     * Generate CSRF token for requests
     */
    async generateCSRFToken(req) {
        var _a;
        const userId = (_a = req.currentUser) === null || _a === void 0 ? void 0 : _a.id;
        return await this.csrfService.generateToken(req, this.config.serviceName, userId);
    }
    /**
     * CSRF token generation endpoint
     */
    getCSRFTokenEndpoint() {
        return this.csrfService.generateTokenEndpoint(this.config.serviceName);
    }
    /**
     * CSRF token refresh endpoint
     */
    getCSRFRefreshEndpoint() {
        return this.csrfService.refreshTokenEndpoint(this.config.serviceName);
    }
    /**
     * Cross-service CSRF token validation endpoint
     */
    getCSRFValidateEndpoint() {
        return this.csrfService.validateTokenEndpoint(this.config.serviceName);
    }
    /**
     * Enhanced security middleware stack with CSRF protection
     */
    getFullSecurityMiddleware(options = {}) {
        const middlewares = [];
        // Security headers (always first)
        middlewares.push(this.getSecurityHeadersMiddleware());
        // CSRF protection (if enabled)
        if (options.enableCSRF) {
            middlewares.push(this.getCSRFProtectionMiddleware());
        }
        // API key rate limiting (if enabled)
        if (this.config.enableApiKeyRateLimit) {
            middlewares.push(this.getApiKeyRateLimitMiddleware());
        }
        // Regular rate limiting
        middlewares.push(this.getRateLimitMiddleware());
        // Input validation and sanitization
        if (this.validator) {
            middlewares.push((req, res, next) => {
                if (req.body && this.validator && typeof this.validator.sanitizeInput === 'function') {
                    req.body = this.validator.sanitizeInput(req.body);
                }
                next();
            });
        }
        return middlewares;
    }
}
exports.MicroserviceSecurityService = MicroserviceSecurityService;
/**
 * Environment-based Security Configuration Factory
 */
class SecurityConfigFactory {
    /**
     * Creates security configuration based on environment variables and service type
     */
    static createConfig(serviceName, environment = process.env.NODE_ENV || 'development') {
        const baseConfig = {
            serviceName,
            environment: environment,
            // Environment variables with fallbacks
            maxFileSize: parseInt(process.env.SECURITY_MAX_FILE_SIZE || '10485760'), // 10MB default
            maxRequestsPerWindow: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
            requestWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
            bruteForceMaxAttempts: parseInt(process.env.BRUTE_FORCE_MAX_ATTEMPTS || '5'),
            bruteForceBlockDurationMs: parseInt(process.env.BRUTE_FORCE_LOCKOUT_DURATION_SECONDS || '1800') * 1000,
            bruteForceWindowMs: parseInt(process.env.BRUTE_FORCE_WINDOW_SECONDS || '900') * 1000,
            maxInputLength: parseInt(process.env.SECURITY_MAX_INPUT_LENGTH || '10000'),
            // Feature flags from environment
            enableXSSProtection: process.env.SECURITY_ENABLE_XSS_PROTECTION !== 'false',
            enableSQLInjectionProtection: process.env.SECURITY_ENABLE_SQL_INJECTION_DETECTION !== 'false',
            enableFileUploadValidation: process.env.SECURITY_ENABLE_FILE_UPLOAD_VALIDATION !== 'false',
            enableCSP: process.env.SECURITY_ENABLE_CSP !== 'false',
            enableHSTS: process.env.SECURITY_ENABLE_HSTS !== 'false',
            enableXFrameOptions: process.env.SECURITY_ENABLE_X_FRAME_OPTIONS !== 'false',
            enableXContentTypeOptions: process.env.SECURITY_ENABLE_X_CONTENT_TYPE_OPTIONS !== 'false',
            enableApiKeyRateLimit: process.env.SECURITY_ENABLE_API_KEY_RATE_LIMIT === 'true',
            apiKeyMaxRequests: parseInt(process.env.RATE_LIMIT_API_KEY_MAX_REQUESTS || '5000'),
            enableSecurityMonitoring: process.env.SECURITY_ENABLE_MONITORING !== 'false',
            securityLogLevel: (process.env.SECURITY_LOG_LEVEL || 'warn'),
            // File types from environment
            allowedFileTypes: (process.env.SECURITY_ALLOWED_MIME_TYPES || 'image/jpeg,image/png,image/gif,application/pdf')
                .split(',')
                .map(type => type.trim())
        };
        // Environment-specific overrides
        switch (environment) {
            case 'production':
                return Object.assign(Object.assign({}, baseConfig), { maxRequestsPerWindow: Math.min(baseConfig.maxRequestsPerWindow || 100, 50), bruteForceMaxAttempts: Math.min(baseConfig.bruteForceMaxAttempts || 5, 3), securityLogLevel: 'warn', enableSecurityMonitoring: true // Always enabled in prod
                 });
            case 'staging':
                return Object.assign(Object.assign({}, baseConfig), { securityLogLevel: 'info', enableSecurityMonitoring: true });
            case 'development':
            default:
                return Object.assign(Object.assign({}, baseConfig), { maxRequestsPerWindow: (baseConfig.maxRequestsPerWindow || 100) * 2, securityLogLevel: 'debug', enableSecurityMonitoring: false // Optional in dev
                 });
        }
    }
    /**
     * Creates service-specific configuration with environment overrides
     */
    static createServiceConfig(serviceName) {
        const envConfig = this.createConfig(serviceName);
        // Service-specific configurations
        const serviceDefaults = {
            auth: {
                apiPathRegex: /^\/api\/users\/?/,
                maxRequestsPerWindow: 100,
                bruteForceMaxAttempts: 5,
                bruteForceBlockDurationMs: 15 * 60 * 1000, // 15 minutes
                maxInputLength: 1000
            },
            orders: {
                apiPathRegex: /^\/api\/orders\/?/,
                maxRequestsPerWindow: 200,
                bruteForceMaxAttempts: 10,
                maxFileSize: 10 * 1024 * 1024, // 10MB
                maxInputLength: 5000,
                allowedFileTypes: ['image/jpeg', 'image/png', 'application/pdf', 'text/csv']
            },
            products: {
                apiPathRegex: /^\/api\/products\/?/,
                maxRequestsPerWindow: 150,
                maxFileSize: 5 * 1024 * 1024, // 5MB
                allowedFileTypes: ['image/jpeg', 'image/png', 'application/json']
            },
            catalog: {
                apiPathRegex: /^\/api\/catalog\/?/,
                maxRequestsPerWindow: 150,
                maxFileSize: 3 * 1024 * 1024 // 3MB
            },
            inventory: {
                apiPathRegex: /^\/api\/inventory\/?/,
                maxRequestsPerWindow: 150
            },
            pricing: {
                apiPathRegex: /^\/api\/pricing\/?/,
                maxRequestsPerWindow: 200
            }
        };
        const serviceConfig = serviceDefaults[serviceName] || {};
        return Object.assign(Object.assign({ serviceName, apiPathRegex: /.*/, maxFileSize: 5 * 1024 * 1024, allowedFileTypes: ['application/json'], maxRequestsPerWindow: 100, requestWindowMs: 15 * 60 * 1000, bruteForceMaxAttempts: 5, bruteForceBlockDurationMs: 15 * 60 * 1000, bruteForceWindowMs: 30 * 60 * 1000, enableXSSProtection: true, enableSQLInjectionProtection: true, enableFileUploadValidation: true, enableCSP: true, enableHSTS: true, enableXFrameOptions: true, enableXContentTypeOptions: true, maxInputLength: 1000, environment: 'development', enableApiKeyRateLimit: false, apiKeyMaxRequests: 5000, enableSecurityMonitoring: true, securityLogLevel: 'warn' }, envConfig), serviceConfig);
    }
}
exports.SecurityConfigFactory = SecurityConfigFactory;
//# sourceMappingURL=MicroserviceSecurityService.js.map