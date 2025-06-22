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
     * XSS saldırılarına karşı string temizleme
     */
    sanitizeInput(input: string): string;
    /**
     * SQL Injection tespiti
     */
    detectSQLInjection(input: string): boolean;
    /**
     * NoSQL Injection tespiti (Enhanced)
     */
    detectNoSQLInjection(input: any): boolean;
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