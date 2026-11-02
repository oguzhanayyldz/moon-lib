import { Request, Response, NextFunction } from 'express';
interface UploadedFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    filename?: string;
    path?: string;
    buffer?: Buffer;
}
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    sanitizedData?: any;
}
export interface SecurityValidatorConfig {
    enableXSSProtection?: boolean;
    enableSQLInjectionProtection?: boolean;
    enableFileUploadValidation?: boolean;
    maxFileSize?: number;
    allowedFileTypes?: string[];
    maxInputLength?: number;
    enableInputSanitization?: boolean;
}
export interface FileUploadValidation {
    file: UploadedFile;
    maxSize?: number;
    allowedTypes?: string[];
}
/**
 * detectNoSQLInjection'in izin verdigi en derin ic ice gecme seviyesi (UC-1229).
 * Gerekce: MongoDB belge ic ice gecme siniri 100 seviyedir (BSON nesting limit); bunu asan govde zaten
 * hicbir sorguya/belgeye donusemez. Gercek Moon gövdeleri tipik olarak <10 seviyedir. Body limiti
 * (2-50 MB) tek basina yetmez: `[[[...` 2 bayt/seviye ile 50 MB'ta milyonlarca seviye tasir, oysa
 * ozyineleme yigini ~1950'de tasar.
 */
export declare const MAX_NOSQL_CHECK_DEPTH = 100;
/** inspectNoSQLInput sonucu: temiz / gerçek operatör / derinlik aşımı. */
export type NoSQLInspectionResult = 'clean' | 'injection' | 'too_deep';
/**
 * Security validation service for input sanitization, XSS protection,
 * SQL injection detection, and file upload validation.
 *
 * Usage in microservices:
 * ```typescript
 * import { SecurityValidator } from '@xmoonx/moon-lib';
 *
 * const securityValidator = new SecurityValidator({
 *   enableXSSProtection: true,
 *   enableSQLInjectionProtection: true,
 *   maxFileSize: 5 * 1024 * 1024 // 5MB
 * });
 *
 * // Use in routes
 * app.use('/api', securityValidator.inputValidationMiddleware());
 * ```
 */
export declare class SecurityValidator {
    private config;
    constructor(config?: Partial<SecurityValidatorConfig>);
    /**
     * XSS ve NoSQL injection saldırılarına karşı girdi temizleme
     * @param input Temizlenecek girdi (string veya obje olabilir)
     * @returns Temizlenmiş girdi
     */
    sanitizeInput(input: any): any;
    /**
     * SQL Injection tespiti
     */
    detectSQLInjection(input: string): boolean;
    /**
     * NoSQL Injection tespiti - recursive olarak özellikle MongoDB operatörlerini arar.
     * Derinlik sınırı aşımı da (fail-closed) true döner; ayırt etmek için {@link inspectNoSQLInput}.
     */
    detectNoSQLInjection(input: any): boolean;
    /**
     * detectNoSQLInjection ile aynı denetim; red sebebini ayırır (UC-1229 D1):
     * 'injection' = gerçek MongoDB operatörü, 'too_deep' = derinlik sınırı ({@link MAX_NOSQL_CHECK_DEPTH}) aşıldı.
     */
    inspectNoSQLInput(input: any): NoSQLInspectionResult;
    /**
     * Dosya yükleme güvenlik kontrolü
     */
    validateFileUpload(validation: FileUploadValidation): ValidationResult;
    /**
     * Giriş verilerini doğrula
     */
    validateInput(data: any): ValidationResult;
    /**
     * Request doğrulama middleware
     */
    validateRequest(): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
    /**
     * Dosya yükleme middleware
     */
    validateFileUploadMiddleware(options?: {
        maxSize?: number;
        allowedTypes?: string[];
    }): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
}
export declare const securityValidator: SecurityValidator;
export {};
//# sourceMappingURL=SecurityValidator.d.ts.map