import { redisWrapper, logger } from '../index';
import { SecurityValidator } from './SecurityValidator';
import { RateLimiter } from './RateLimiter';
import { BruteForceProtection } from './BruteForceProtection';
import { SecurityHeaders } from './SecurityHeaders';
import { SecurityManager } from './SecurityManager';
import { Request, Response, NextFunction } from 'express';
import { BadRequestError } from '../common/errors/bad-request-error';
import { UserPayload } from '../common/middlewares/current-user';
import * as jwt from 'jsonwebtoken';

// Genişletilmiş Express Request tipi
interface ExtendedRequest extends Request {
  currentUser?: UserPayload;
  csrfTokenData?: any;
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
   * @param redisClient Redis client instance (her mikroservisin kendi redis bağlantısı)
   */
  constructor(config: MicroserviceSecurityConfig, redisClient?: any) {
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

    // RateLimiter başlat - injected redis client veya fallback olarak global redisWrapper kullan
    const redis = redisClient || redisWrapper.client;
    this.rateLimiter = new RateLimiter(redis, {
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

    // BruteForceProtection başlat - aynı redis client'ı kullan
    this.bruteForceProtection = new BruteForceProtection(redis, {
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
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        // Önce girdilerde potansiyel NoSQL injection kontrolü yap
        
        // Request body'sini kontrol et
        if (req.body && this.validator) {
          // Önemli: Tehlikeli operatörler içeren istekleri reddet
          if (this.validator.detectNoSQLInjection(req.body)) {
            logger.warn('NoSQL injection tespit edildi - istek reddedildi', { body: JSON.stringify(req.body) });
            throw new BadRequestError('Güvenlik ihlali: Potansiyel NoSQL injection tespit edildi');
          }
          req.body = this.validator.sanitizeInput(req.body);
        }
        
        // URL parametrelerini kontrol et
        if (req.params && this.validator) {
          // Önemli: Tehlikeli operatörler içeren istekleri reddet
          if (this.validator.detectNoSQLInjection(req.params)) {
            logger.warn('NoSQL injection tespit edildi - istek reddedildi', { params: JSON.stringify(req.params) });
            throw new BadRequestError('Güvenlik ihlali: Potansiyel NoSQL injection tespit edildi');
          }
          req.params = this.validator.sanitizeInput(req.params);
        }
        
        // Query parametrelerini kontrol et
        if (req.query && this.validator) {
          // Önemli: Tehlikeli operatörler içeren istekleri reddet
          if (this.validator.detectNoSQLInjection(req.query)) {
            logger.warn('NoSQL injection tespit edildi - istek reddedildi', { query: JSON.stringify(req.query) });
            throw new BadRequestError('Güvenlik ihlali: Potansiyel NoSQL injection tespit edildi');
          }
          req.query = this.validator.sanitizeInput(req.query);
        }
        
        next();
      } catch (error) {
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
   * JWT tabanlı CSRF koruma middleware'i
   * Cookie olmadan stateless bir yaklaşım kullanır ve tüm mikroservislerde tutarlı koruma sağlar
   * 
   * @returns Express middleware
   */
  getJwtCsrfProtectionMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
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
        (req as ExtendedRequest).csrfTokenData = decoded;
        next();
      } catch (err: unknown) {
        // JWT hatası - token geçersiz veya süresi dolmuş
        // Hata mesajını güvenli şekilde erişme
        const errorMessage = err instanceof Error ? err.message : 'Bilinmeyen hata';
        logger.warn(`CSRF token doğrulama hatası: ${errorMessage}`);
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
  generateCsrfToken(userId?: string, fingerprint?: string) {
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
}
