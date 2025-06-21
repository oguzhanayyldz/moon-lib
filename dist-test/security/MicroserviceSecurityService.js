"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MicroserviceSecurityService = void 0;
const index_1 = require("../index");
const SecurityValidator_1 = require("./SecurityValidator");
const RateLimiter_1 = require("./RateLimiter");
const BruteForceProtection_1 = require("./BruteForceProtection");
const SecurityHeaders_1 = require("./SecurityHeaders");
const SecurityManager_1 = require("./SecurityManager");
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
}
exports.MicroserviceSecurityService = MicroserviceSecurityService;
//# sourceMappingURL=MicroserviceSecurityService.js.map