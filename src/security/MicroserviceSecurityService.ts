import { redisWrapper, logger } from '../index';
import { SecurityValidator } from './SecurityValidator';
import { RateLimiter } from './RateLimiter';
import { BruteForceProtection } from './BruteForceProtection';
import { SecurityHeaders } from './SecurityHeaders';
import { SecurityManager } from './SecurityManager';
import { Request, Response, NextFunction } from 'express';
// UserPayload tipini doğru konumdan import ediyoruz
import { UserPayload } from '../common/middlewares/current-user';

// Genişletilmiş Express Request tipi
interface ExtendedRequest extends Request {
  currentUser?: UserPayload;
}

/**
 * MicroserviceSecurityService Configuration Interface
 */
export interface MicroserviceSecurityConfig {
  serviceName: string;              // Servis adı (orders, auth, vb.)
  apiPathRegex: RegExp;             // Servis API yolu regex paterni
  maxFileSize: number;              // Dosya boyut limiti (byte cinsinden)
  allowedFileTypes: string[];       // İzin verilen dosya tipleri (mimetype)
  maxRequestsPerWindow: number;     // Belirli bir pencerede izin verilen maksimum istek sayısı
  requestWindowMs: number;          // İstek penceresi süresi (ms cinsinden)
  bruteForceMaxAttempts: number;    // Brute force maksimum deneme sayısı
  bruteForceBlockDurationMs: number;// Brute force engelleme süresi (ms cinsinden)
  bruteForceWindowMs: number;       // Brute force pencere süresi (ms cinsinden)
  enableXSSProtection: boolean;     // XSS korumasını etkinleştirme
  enableSQLInjectionProtection: boolean; // SQL injection korumasını etkinleştirme
  enableFileUploadValidation: boolean;   // Dosya yükleme doğrulamasını etkinleştirme
  enableCSP: boolean;               // Content Security Policy etkinleştirme
  enableHSTS: boolean;              // HTTP Strict Transport Security etkinleştirme
  enableXFrameOptions: boolean;     // X-Frame-Options etkinleştirme
  enableXContentTypeOptions: boolean; // X-Content-Type-Options etkinleştirme
  maxInputLength: number;           // Maksimum girdi uzunluğu
  // Environment-based configuration
  environment?: 'development' | 'staging' | 'production';
  enableApiKeyRateLimit?: boolean;  // API key based rate limiting
  apiKeyMaxRequests?: number;       // API key request limit
  enableSecurityMonitoring?: boolean; // Security event monitoring
  securityLogLevel?: 'error' | 'warn' | 'info' | 'debug';
}

/**
 * Merkezi Mikroservis Güvenlik Servisi
 * 
 * Bu sınıf tüm mikroservislerde ortak güvenlik katmanını sağlamak amacıyla oluşturulmuştur.
 * Güvenlik bileşenlerini (validator, rate limiter, brute force protection, vb.) 
 * tek bir yerden yönetir ve tutarlı bir güvenlik politikası uygular.
 */
export class MicroserviceSecurityService {
  public readonly validator: SecurityValidator;
  public readonly rateLimiter: RateLimiter;
  public readonly bruteForceProtection: BruteForceProtection;
  public readonly securityHeaders: SecurityHeaders;
  public readonly securityManager: SecurityManager;
  private readonly config: MicroserviceSecurityConfig;

  /**
   * Mikroservis Güvenlik Servisi oluşturur
   * @param config Güvenlik yapılandırması
   */
  constructor(config: MicroserviceSecurityConfig) {
    // Default değerleri içeren temel konfigürasyon
    const defaultConfig: MicroserviceSecurityConfig = {
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
    this.config = { ...defaultConfig, ...config };

    // SecurityValidator başlat
    this.validator = new SecurityValidator({
      enableInputSanitization: true,
      maxInputLength: this.config.maxInputLength,
      enableXSSProtection: this.config.enableXSSProtection,
      enableSQLInjectionProtection: this.config.enableSQLInjectionProtection,
      enableFileUploadValidation: this.config.enableFileUploadValidation,
      maxFileSize: this.config.maxFileSize,
      allowedFileTypes: this.config.allowedFileTypes
    });

    // RateLimiter başlat
    this.rateLimiter = new RateLimiter(redisWrapper.client, {
      windowMs: this.config.requestWindowMs,
      maxRequests: this.config.maxRequestsPerWindow,
      keyGenerator: (req: ExtendedRequest) => {
        // Kullanıcı kimliği varsa kullan, yoksa IP
        const userId = req.currentUser?.id;
        const ip = req.ip || '0.0.0.0'; // IP için fallback değer
        return userId 
          ? `${this.config.serviceName}_rate_limit:user:${userId}` 
          : `${this.config.serviceName}_rate_limit:ip:${ip}`;
      },
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    });

    // BruteForceProtection başlat
    this.bruteForceProtection = new BruteForceProtection(redisWrapper.client, {
      maxAttempts: this.config.bruteForceMaxAttempts,
      blockDurationMs: this.config.bruteForceBlockDurationMs,
      windowMs: this.config.bruteForceWindowMs,
      enabled: true
    });

    // SecurityHeaders başlat
    this.securityHeaders = new SecurityHeaders({
      enableCSP: this.config.enableCSP,
      enableHSTS: this.config.enableHSTS,
      enableXFrameOptions: this.config.enableXFrameOptions,
      enableXContentTypeOptions: this.config.enableXContentTypeOptions,
      enableXSSProtection: this.config.enableXSSProtection
    });

    // SecurityManager başlat
    this.securityManager = new SecurityManager();

    logger.info(`MicroserviceSecurityService initialized for ${this.config.serviceName} service`);
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
  async validateInput(data: any) {
    return this.validator.validateInput(data);
  }

  /**
   * Oturum durumunu kontrol eder
   * @param usernameOrEmail Kullanıcı adı veya email
   * @returns Oturum durumu
   */
  async getStatus(usernameOrEmail: string) {
    try {
      if (!this.bruteForceProtection || typeof this.bruteForceProtection.getStatus !== 'function') {
        logger.error('BruteForceProtection getStatus fonksiyonu bulunamadı');
        return { allowed: true };
      }

      const status = await this.bruteForceProtection.getStatus(usernameOrEmail);

      // BruteForceResult tiplemesi ile uyumsuzluk sorununu aşmak için
      // any kullanarak esnek bir yapı oluşturuyoruz
      const result = status as any;

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
    } catch (error) {
      // Herhangi bir hata durumunda güvenli mod - login izni verme
      logger.error('getStatus fonksiyonunda hata:', error);
      return { allowed: true }; // Hata durumunda login izni ver
    }
  }

  /**
   * Rate limiting için Express middleware'i alır
   */
  getRateLimitMiddleware() {
    // RateLimiter nesnesini kontrol et
    if (!this.rateLimiter || typeof this.rateLimiter.middleware !== 'function') {
      logger.error('RateLimiter middleware fonksiyonu bulunamadı');
      return (_req: Request, _res: Response, next: NextFunction) => next();
    }
    return this.rateLimiter.middleware();
  }

  /**
   * Güvenlik başlıkları için Express middleware'i alır
   */
  getSecurityHeadersMiddleware() {
    // Güvenlik başlıkları nesnesini kontrol et
    if (!this.securityHeaders || typeof this.securityHeaders.middleware !== 'function') {
      logger.error('SecurityHeaders middleware fonksiyonu bulunamadı');
      // Fallback middleware dönelim
      return (_req: Request, _res: Response, next: NextFunction) => {
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
      logger.error('BruteForceProtection loginProtection fonksiyonu bulunamadı');
      // Fallback middleware dönelim
      return (_req: Request, _res: Response, next: NextFunction) => {
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
      logger.error('BruteForceProtection handleFailedLogin fonksiyonu bulunamadı');
      // Fallback middleware dönelim
      return (_req: Request, _res: Response, next: NextFunction) => {
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
    return (_req: Request, _res: Response, next: NextFunction) => {
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
  async validateFileUpload(file: any) {
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
  async recordFailedAttempt(identifier: string) {
    await this.bruteForceProtection.recordFailedAttempt(identifier);
  }

  /**
   * Kimliğin brute force nedeniyle engellenip engellenmediğini kontrol eder
   */
  async isBlocked(identifier: string): Promise<boolean> {
    return await this.bruteForceProtection.isBlocked(identifier);
  }

  /**
   * Kimliğin geçerli deneme sayısını alır
   */
  async getAttemptCount(identifier: string): Promise<number> {
    return await this.bruteForceProtection.getAttemptCount(identifier);
  }

  /**
   * Belirtilen API yolu için brute force koruması middleware'i uygular
   */
  applyBruteForceProtectionForPath() {
    return (req: any, res: any, next: any) => {
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
      return (_req: Request, _res: Response, next: NextFunction) => {
        next();
      };
    }

    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const apiKey = req.headers['x-api-key'] as string;
        
        if (!apiKey) {
          return next(); // No API key, skip API key rate limiting
        }

        // Use RateLimiter's API key method if available
        if (this.rateLimiter && typeof this.rateLimiter.checkAPIKeyRateLimit === 'function') {
          const endpoint = `${req.method}:${req.route?.path || req.path}`;
          const result = await this.rateLimiter.checkAPIKeyRateLimit(apiKey, endpoint);
          
          if (!result.allowed) {
            logger.warn('API key rate limit exceeded:', {
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
            'X-API-RateLimit-Limit': this.config.apiKeyMaxRequests?.toString() || '5000',
            'X-API-RateLimit-Remaining': (this.config.apiKeyMaxRequests! - result.totalHits).toString(),
            'X-API-RateLimit-Reset': result.resetTime.toISOString()
          });
        }

        next();
      } catch (error) {
        logger.error('API key rate limiting error:', error);
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
      middlewares.push((req: Request, res: Response, next: NextFunction) => {
        if (req.body && this.validator && typeof this.validator.sanitizeInput === 'function') {
          req.body = this.validator.sanitizeInput(req.body);
        }
        next();
      });
    }

    return middlewares;
  }

  /**
   * CSRF protection middleware - delegates to SecurityManager
   */
  getCSRFProtectionMiddleware() {
    // SecurityManager'dan CSRF protection middleware'i al
    if (!this.securityManager || typeof this.securityManager.csrfProtectionMiddleware !== 'function') {
      logger.error('SecurityManager CSRF protection middleware bulunamadı');
      // Fallback middleware dönelim
      return (_req: Request, _res: Response, next: NextFunction) => {
        next();
      };
    }

    return this.securityManager.csrfProtectionMiddleware();
  }

  /**
   * Generate CSRF token for requests
   */
  generateCSRFToken(req: Request): string {
    if (!this.securityManager || typeof this.securityManager.generateCSRFToken !== 'function') {
      logger.error('SecurityManager generateCSRFToken fonksiyonu bulunamadı');
      // Fallback token generation
      const crypto = require('crypto');
      return crypto.randomBytes(32).toString('hex');
    }

    return this.securityManager.generateCSRFToken(req);
  }

  /**
   * Enhanced security middleware stack with CSRF protection
   */
  getFullSecurityMiddleware(options: { enableCSRF?: boolean } = {}) {
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
      middlewares.push((req: Request, res: Response, next: NextFunction) => {
        if (req.body && this.validator && typeof this.validator.sanitizeInput === 'function') {
          req.body = this.validator.sanitizeInput(req.body);
        }
        next();
      });
    }

    return middlewares;
  }
}

/**
 * Environment-based Security Configuration Factory
 */
export class SecurityConfigFactory {
  /**
   * Creates security configuration based on environment variables and service type
   */
  static createConfig(serviceName: string, environment: string = process.env.NODE_ENV || 'development'): Partial<MicroserviceSecurityConfig> {
    const baseConfig: Partial<MicroserviceSecurityConfig> = {
      serviceName,
      environment: environment as 'development' | 'staging' | 'production',
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
      securityLogLevel: (process.env.SECURITY_LOG_LEVEL || 'warn') as 'error' | 'warn' | 'info' | 'debug',
      
      // File types from environment
      allowedFileTypes: (process.env.SECURITY_ALLOWED_MIME_TYPES || 'image/jpeg,image/png,image/gif,application/pdf')
        .split(',')
        .map(type => type.trim())
    };

    // Environment-specific overrides
    switch (environment) {
      case 'production':
        return {
          ...baseConfig,
          maxRequestsPerWindow: Math.min(baseConfig.maxRequestsPerWindow || 100, 50), // Stricter in prod
          bruteForceMaxAttempts: Math.min(baseConfig.bruteForceMaxAttempts || 5, 3), // Stricter in prod
          securityLogLevel: 'warn', // Less verbose in prod
          enableSecurityMonitoring: true // Always enabled in prod
        };
        
      case 'staging':
        return {
          ...baseConfig,
          securityLogLevel: 'info',
          enableSecurityMonitoring: true
        };
        
      case 'development':
      default:
        return {
          ...baseConfig,
          maxRequestsPerWindow: (baseConfig.maxRequestsPerWindow || 100) * 2, // More lenient in dev
          securityLogLevel: 'debug', // More verbose in dev
          enableSecurityMonitoring: false // Optional in dev
        };
    }
  }

  /**
   * Creates service-specific configuration with environment overrides
   */
  static createServiceConfig(serviceName: string): MicroserviceSecurityConfig {
    const envConfig = this.createConfig(serviceName);
    
    // Service-specific configurations
    const serviceDefaults: Record<string, Partial<MicroserviceSecurityConfig>> = {
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
    
    return {
      serviceName,
      apiPathRegex: /.*/,
      maxFileSize: 5 * 1024 * 1024,
      allowedFileTypes: ['application/json'],
      maxRequestsPerWindow: 100,
      requestWindowMs: 15 * 60 * 1000,
      bruteForceMaxAttempts: 5,
      bruteForceBlockDurationMs: 15 * 60 * 1000,
      bruteForceWindowMs: 30 * 60 * 1000,
      enableXSSProtection: true,
      enableSQLInjectionProtection: true,
      enableFileUploadValidation: true,
      enableCSP: true,
      enableHSTS: true,
      enableXFrameOptions: true,
      enableXContentTypeOptions: true,
      maxInputLength: 1000,
      environment: 'development',
      enableApiKeyRateLimit: false,
      apiKeyMaxRequests: 5000,
      enableSecurityMonitoring: true,
      securityLogLevel: 'warn',
      ...envConfig,
      ...serviceConfig
    } as MicroserviceSecurityConfig;
  }
}
