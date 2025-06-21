import { SecurityValidator } from './SecurityValidator';
import { RateLimiter } from './RateLimiter';
import { BruteForceProtection } from './BruteForceProtection';
import { SecurityHeaders } from './SecurityHeaders';
import { SecurityManager } from './SecurityManager';
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
}
