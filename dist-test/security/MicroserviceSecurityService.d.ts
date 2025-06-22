import { SecurityValidator } from './SecurityValidator';
import { RateLimiter } from './RateLimiter';
import { BruteForceProtection } from './BruteForceProtection';
import { SecurityHeaders } from './SecurityHeaders';
import { SecurityManager } from './SecurityManager';
import { CSRFService } from './CSRFService';
import { Request, Response, NextFunction } from 'express';
/**
 * MicroserviceSecurityService Configuration Interface
 */
export interface MicroserviceSecurityConfig {
    serviceName: string;
    apiPathRegex: RegExp;
    maxFileSize: number;
    allowedFileTypes: string[];
    maxRequestsPerWindow: number;
    requestWindowMs: number;
    bruteForceMaxAttempts: number;
    bruteForceBlockDurationMs: number;
    bruteForceWindowMs: number;
    enableXSSProtection: boolean;
    enableSQLInjectionProtection: boolean;
    enableFileUploadValidation: boolean;
    enableCSP: boolean;
    enableHSTS: boolean;
    enableXFrameOptions: boolean;
    enableXContentTypeOptions: boolean;
    maxInputLength: number;
    environment?: 'development' | 'staging' | 'production';
    enableApiKeyRateLimit?: boolean;
    apiKeyMaxRequests?: number;
    enableSecurityMonitoring?: boolean;
    securityLogLevel?: 'error' | 'warn' | 'info' | 'debug';
}
/**
 * Merkezi Mikroservis Güvenlik Servisi
 *
 * Bu sınıf tüm mikroservislerde ortak güvenlik katmanını sağlamak amacıyla oluşturulmuştur.
 * Güvenlik bileşenlerini (validator, rate limiter, brute force protection, vb.)
 * tek bir yerden yönetir ve tutarlı bir güvenlik politikası uygular.
 */
export declare class MicroserviceSecurityService {
    readonly validator: SecurityValidator;
    readonly rateLimiter: RateLimiter;
    readonly bruteForceProtection: BruteForceProtection;
    readonly securityHeaders: SecurityHeaders;
    readonly securityManager: SecurityManager;
    readonly csrfService: CSRFService;
    private readonly config;
    /**
     * Mikroservis Güvenlik Servisi oluşturur
     * @param config Güvenlik yapılandırması
     */
    constructor(config: MicroserviceSecurityConfig);
    /**
     * Input doğrulaması gerçekleştirir
     *
     * Tüm validasyon işlemleri için merkezi metod.
     * Login, sipariş, güncelleme gibi tüm validasyonlar için kullanılır.
     *
     * @param data Doğrulanacak veri
     * @returns Doğrulama sonucu
     */
    validateInput(data: any): Promise<import("./SecurityValidator").ValidationResult>;
    /**
     * Oturum durumunu kontrol eder
     * @param usernameOrEmail Kullanıcı adı veya email
     * @returns Oturum durumu
     */
    getStatus(usernameOrEmail: string): Promise<{
        allowed: boolean;
        remainingTime?: undefined;
    } | {
        allowed: any;
        remainingTime: any;
    }>;
    /**
     * Rate limiting için Express middleware'i alır
     */
    getRateLimitMiddleware(): (_req: Request, _res: Response, next: NextFunction) => void;
    /**
     * Güvenlik başlıkları için Express middleware'i alır
     */
    getSecurityHeadersMiddleware(): (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Brute force koruması için Express middleware'i alır
     */
    getBruteForceMiddleware(): (_req: Request, _res: Response, next: NextFunction) => void;
    /**
     * Başarısız giriş işlemleri için Express middleware'i alır
     */
    getFailedLoginHandlerMiddleware(): (_req: Request, _res: Response, next: NextFunction) => void;
    /**
     * Kullanıcıya özgü rate limiting middleware'i
     * Not: Servis-özel işlevlerle geriye dönük uyumluluk için
     */
    getUserRateLimitMiddleware(): (_req: Request, _res: Response, next: NextFunction) => void;
    /**
     * Dosya yükleme validasyon middleware'i
     * Not: Servis-özel işlevlerle geriye dönük uyumluluk için
     */
    getFileUploadValidationMiddleware(): (_req: Request, _res: Response, next: NextFunction) => void;
    /**
     * Dosya yükleme validasyonu yapar
     * @param file Yüklenecek dosya objesi
     */
    validateFileUpload(file: any): Promise<import("./SecurityValidator").ValidationResult>;
    /**
     * Başarısız giriş denemesini kaydeder
     */
    recordFailedAttempt(identifier: string): Promise<void>;
    /**
     * Kimliğin brute force nedeniyle engellenip engellenmediğini kontrol eder
     */
    isBlocked(identifier: string): Promise<boolean>;
    /**
     * Kimliğin geçerli deneme sayısını alır
     */
    getAttemptCount(identifier: string): Promise<number>;
    /**
     * Belirtilen API yolu için brute force koruması middleware'i uygular
     */
    applyBruteForceProtectionForPath(): (req: any, res: any, next: any) => void;
    /**
     * API Key based rate limiting middleware
     */
    getApiKeyRateLimitMiddleware(): (_req: Request, _res: Response, next: NextFunction) => void;
    /**
     * Combined security middleware with API key support
     */
    getEnhancedSecurityMiddleware(): ((req: Request, res: Response, next: NextFunction) => void)[];
    /**
     * CSRF protection middleware - uses enhanced CSRFService
     */
    getCSRFProtectionMiddleware(): (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
    /**
     * Generate CSRF token for requests
     */
    generateCSRFToken(req: Request): Promise<string>;
    /**
     * CSRF token generation endpoint
     */
    getCSRFTokenEndpoint(): (req: Request, res: Response) => Promise<void>;
    /**
     * CSRF token refresh endpoint
     */
    getCSRFRefreshEndpoint(): (req: Request, res: Response) => Promise<void>;
    /**
     * Cross-service CSRF token validation endpoint
     */
    getCSRFValidateEndpoint(): (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Enhanced security middleware stack with CSRF protection
     */
    getFullSecurityMiddleware(options?: {
        enableCSRF?: boolean;
    }): ((req: Request, res: Response, next: NextFunction) => void)[];
}
/**
 * Environment-based Security Configuration Factory
 */
export declare class SecurityConfigFactory {
    /**
     * Creates security configuration based on environment variables and service type
     */
    static createConfig(serviceName: string, environment?: string): Partial<MicroserviceSecurityConfig>;
    /**
     * Creates service-specific configuration with environment overrides
     */
    static createServiceConfig(serviceName: string): MicroserviceSecurityConfig;
}
//# sourceMappingURL=MicroserviceSecurityService.d.ts.map