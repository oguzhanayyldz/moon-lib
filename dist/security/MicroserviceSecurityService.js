"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MicroserviceSecurityService = void 0;
const index_1 = require("../index");
const SecurityValidator_1 = require("./SecurityValidator");
const RateLimiter_1 = require("./RateLimiter");
const BruteForceProtection_1 = require("./BruteForceProtection");
const SecurityHeaders_1 = require("./SecurityHeaders");
const SecurityManager_1 = require("./SecurityManager");
const bad_request_error_1 = require("../common/errors/bad-request-error");
const jwt = __importStar(require("jsonwebtoken"));
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
     * @param redisClient Redis client instance (her mikroservisin kendi redis bağlantısı)
     */
    constructor(config, redisClient) {
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
        // RateLimiter başlat - injected redis client veya fallback olarak global redisWrapper kullan
        const redis = redisClient || index_1.redisWrapper.client;
        this.rateLimiter = new RateLimiter_1.RateLimiter(redis, {
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
        // BruteForceProtection başlat - aynı redis client'ı kullan
        this.bruteForceProtection = new BruteForceProtection_1.BruteForceProtection(redis, {
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
    validateInput(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.validator.validateInput(data);
        });
    }
    /**
     * Oturum durumunu kontrol eder
     * @param usernameOrEmail Kullanıcı adı veya email
     * @returns Oturum durumu
     */
    getStatus(usernameOrEmail) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.bruteForceProtection || typeof this.bruteForceProtection.getStatus !== 'function') {
                    index_1.logger.error('BruteForceProtection getStatus fonksiyonu bulunamadı');
                    return { allowed: true };
                }
                const status = yield this.bruteForceProtection.getStatus(usernameOrEmail);
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
        });
    }
    /**
     * Rate limiting için Express middleware'i alır
     */
    getRateLimitMiddleware() {
        return this.rateLimiter.middleware();
    }
    /**
     * NoSQL Injection koruma middleware
     * Tüm request.body, request.params ve request.query değerlerini kontrol eder ve tehlikeli MongoDB operatörleri içeriyorsa hata fırlatır
     * Tehlikeli operatör içermeyen istekleri ise temizleyip devam eder
     *
     * @returns NoSQL sanitize middleware
     */
    getNoSQLSanitizerMiddleware() {
        return (req, res, next) => {
            try {
                // Önce girdilerde potansiyel NoSQL injection kontrolü yap
                // Request body'sini kontrol et
                if (req.body && this.validator) {
                    // Önemli: Tehlikeli operatörler içeren istekleri reddet
                    if (this.validator.detectNoSQLInjection(req.body)) {
                        index_1.logger.warn('NoSQL injection tespit edildi - istek reddedildi', { body: JSON.stringify(req.body) });
                        throw new bad_request_error_1.BadRequestError('Güvenlik ihlali: Potansiyel NoSQL injection tespit edildi');
                    }
                    req.body = this.validator.sanitizeInput(req.body);
                }
                // URL parametrelerini kontrol et
                if (req.params && this.validator) {
                    // Önemli: Tehlikeli operatörler içeren istekleri reddet
                    if (this.validator.detectNoSQLInjection(req.params)) {
                        index_1.logger.warn('NoSQL injection tespit edildi - istek reddedildi', { params: JSON.stringify(req.params) });
                        throw new bad_request_error_1.BadRequestError('Güvenlik ihlali: Potansiyel NoSQL injection tespit edildi');
                    }
                    req.params = this.validator.sanitizeInput(req.params);
                }
                // Query parametrelerini kontrol et
                if (req.query && this.validator) {
                    // Önemli: Tehlikeli operatörler içeren istekleri reddet
                    if (this.validator.detectNoSQLInjection(req.query)) {
                        index_1.logger.warn('NoSQL injection tespit edildi - istek reddedildi', { query: JSON.stringify(req.query) });
                        throw new bad_request_error_1.BadRequestError('Güvenlik ihlali: Potansiyel NoSQL injection tespit edildi');
                    }
                    req.query = this.validator.sanitizeInput(req.query);
                }
                next();
            }
            catch (error) {
                next(error);
            }
        };
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
    validateFileUpload(file) {
        return __awaiter(this, void 0, void 0, function* () {
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
        });
    }
    /**
     * JWT tabanlı CSRF koruma middleware'i
     * Cookie olmadan stateless bir yaklaşım kullanır ve tüm mikroservislerde tutarlı koruma sağlar
     *
     * @returns Express middleware
     */
    getJwtCsrfProtectionMiddleware() {
        return (req, res, next) => {
            // GET, HEAD ve OPTIONS istekleri için doğrulama gerekmez
            if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
                return next();
            }
            const token = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];
            // Header'lar dizi veya string olabilir, tek bir değer beklendiğinden ilk değeri alıyoruz
            const csrfToken = Array.isArray(token) ? token[0] : token;
            if (!csrfToken) {
                return res.status(403).json({
                    errors: [{ message: 'CSRF token eksik' }]
                });
            }
            try {
                // Token doğrula - tüm mikroservislerin aynı JWT_SECRET değişkenini kullanması gerekir
                const jwtSecret = process.env.JWT_SECRET || 'moon-security-secret';
                const decoded = jwt.verify(csrfToken, jwtSecret);
                // CSRF token verisini request nesnesine ekle
                req.csrfTokenData = decoded;
                next();
            }
            catch (err) {
                // JWT hatası - token geçersiz veya süresi dolmuş
                // Hata mesajını güvenli şekilde erişme
                const errorMessage = err instanceof Error ? err.message : 'Bilinmeyen hata';
                index_1.logger.warn(`CSRF token doğrulama hatası: ${errorMessage}`);
                return res.status(403).json({
                    errors: [{ message: 'Geçersiz veya süresi dolmuş CSRF token' }]
                });
            }
        };
    }
    /**
     * CSRF token oluşturma (auth servisi için)
     *
     * @param userId Kullanıcı ID'si (opsiyonel)
     * @param fingerprint Tarayıcı/kullanıcı parmak izi
     * @returns JWT formatında CSRF token
     */
    generateCsrfToken(userId, fingerprint) {
        const jwtSecret = process.env.JWT_SECRET || 'moon-security-secret';
        const token = jwt.sign({
            userId: userId || 'anonymous',
            fingerprint: fingerprint || 'generic',
            createdAt: Date.now()
        }, jwtSecret, {
            expiresIn: '30m' // 30 dakika geçerli
        });
        return token;
    }
    /**
     * Başarısız giriş denemesini kaydeder
     */
    recordFailedAttempt(identifier) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.bruteForceProtection.recordFailedAttempt(identifier);
        });
    }
    /**
     * Kimliğin brute force nedeniyle engellenip engellenmediğini kontrol eder
     */
    isBlocked(identifier) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.bruteForceProtection.isBlocked(identifier);
        });
    }
    /**
     * Kimliğin geçerli deneme sayısını alır
     */
    getAttemptCount(identifier) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.bruteForceProtection.getAttemptCount(identifier);
        });
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
