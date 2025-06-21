"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityValidator = exports.SecurityValidator = void 0;
const logger_service_1 = require("../services/logger.service");
// Simple XSS protection function
function sanitizeString(input) {
    if (typeof input !== 'string')
        return input;
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
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
class SecurityValidator {
    constructor(config) {
        this.config = Object.assign({ enableXSSProtection: true, enableSQLInjectionProtection: true, enableFileUploadValidation: true, maxFileSize: 5 * 1024 * 1024, allowedFileTypes: ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx'], maxInputLength: 10000, enableInputSanitization: true }, config);
    }
    /**
     * XSS saldırılarına karşı string temizleme
     */
    sanitizeInput(input) {
        if (!this.config.enableInputSanitization) {
            return input;
        }
        try {
            return sanitizeString(input);
        }
        catch (error) {
            logger_service_1.logger.error('XSS sanitization error:', error);
            return '';
        }
    }
    /**
     * SQL Injection tespiti
     */
    detectSQLInjection(input) {
        if (!this.config.enableSQLInjectionProtection) {
            return false;
        }
        const sqlPatterns = [
            /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b)/i,
            /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/i,
            /(['"])\s*;\s*DROP\s+TABLE/i,
            /(['"])\s*;\s*--/i,
            /\bEXEC\b|\bEXECUTE\b/i
        ];
        return sqlPatterns.some(pattern => pattern.test(input));
    }
    /**
     * NoSQL Injection tespiti
     */
    detectNoSQLInjection(input) {
        if (typeof input === 'object' && input !== null) {
            const dangerousKeys = ['$where', '$regex', '$gt', '$gte', '$lt', '$lte', '$ne', '$in', '$nin'];
            return Object.keys(input).some(key => dangerousKeys.includes(key));
        }
        return false;
    }
    /**
     * Dosya yükleme güvenlik kontrolü
     */
    validateFileUpload(validation) {
        var _a;
        if (!this.config.enableFileUploadValidation) {
            return { isValid: true, errors: [] };
        }
        const { file, maxSize, allowedTypes } = validation;
        const errors = [];
        // Dosya boyutu kontrolü
        const fileSizeLimit = maxSize || this.config.maxFileSize;
        if (file.size > fileSizeLimit) {
            errors.push(`File size exceeds limit (${fileSizeLimit} bytes)`);
        }
        // Dosya tipi kontrolü
        const fileTypes = allowedTypes || this.config.allowedFileTypes;
        const fileExtension = (_a = file.originalname.split('.').pop()) === null || _a === void 0 ? void 0 : _a.toLowerCase();
        if (fileExtension && !fileTypes.includes(fileExtension)) {
            errors.push(`File type not allowed. Allowed types: ${fileTypes.join(', ')}`);
        }
        // MIME type kontrolü
        const allowedMimeTypes = [
            'image/jpeg', 'image/png', 'image/gif',
            'application/pdf', 'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (!allowedMimeTypes.includes(file.mimetype)) {
            errors.push(`MIME type not allowed: ${file.mimetype}`);
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    /**
     * Giriş verilerini doğrula
     */
    validateInput(data) {
        const errors = [];
        let sanitizedData = data;
        try {
            // String değerleri kontrol et
            if (typeof data === 'string') {
                // Uzunluk kontrolü
                if (data.length > this.config.maxInputLength) {
                    errors.push(`Input length exceeds maximum (${this.config.maxInputLength})`);
                }
                // XSS kontrolü
                const sanitized = this.sanitizeInput(data);
                if (sanitized !== data) {
                    logger_service_1.logger.warn('XSS attempt detected and sanitized');
                }
                // SQL Injection kontrolü
                if (this.detectSQLInjection(data)) {
                    errors.push('SQL injection attempt detected');
                }
                sanitizedData = sanitized;
            }
            // Object kontrolü
            if (typeof data === 'object' && data !== null) {
                if (this.detectNoSQLInjection(data)) {
                    errors.push('NoSQL injection attempt detected');
                }
                // Nested object kontrolü
                const processedData = {};
                for (const [key, value] of Object.entries(data)) {
                    if (typeof value === 'string') {
                        const result = this.validateInput(value);
                        if (!result.isValid) {
                            errors.push(...result.errors);
                        }
                        processedData[key] = result.sanitizedData;
                    }
                    else {
                        processedData[key] = value;
                    }
                }
                sanitizedData = processedData;
            }
        }
        catch (error) {
            logger_service_1.logger.error('Input validation error:', error);
            errors.push('Validation error occurred');
        }
        return {
            isValid: errors.length === 0,
            errors,
            sanitizedData
        };
    }
    /**
     * Request doğrulama middleware
     */
    validateRequest() {
        return (req, res, next) => {
            try {
                // Body validation
                if (req.body) {
                    const bodyResult = this.validateInput(req.body);
                    if (!bodyResult.isValid) {
                        logger_service_1.logger.warn('Invalid request body:', { errors: bodyResult.errors, ip: req.ip });
                        return res.status(400).json({
                            error: 'Invalid request data',
                            details: bodyResult.errors
                        });
                    }
                    req.body = bodyResult.sanitizedData;
                }
                // Query parameters validation
                if (req.query) {
                    const queryResult = this.validateInput(req.query);
                    if (!queryResult.isValid) {
                        logger_service_1.logger.warn('Invalid query parameters:', { errors: queryResult.errors, ip: req.ip });
                        return res.status(400).json({
                            error: 'Invalid query parameters',
                            details: queryResult.errors
                        });
                    }
                    req.query = queryResult.sanitizedData;
                }
                next();
            }
            catch (error) {
                logger_service_1.logger.error('Request validation middleware error:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        };
    }
    /**
     * Dosya yükleme middleware
     */
    validateFileUploadMiddleware(options) {
        return (req, res, next) => {
            try {
                // Single file check
                if (req.file) {
                    const result = this.validateFileUpload(Object.assign({ file: req.file }, options));
                    if (!result.isValid) {
                        logger_service_1.logger.warn('File upload validation failed:', { errors: result.errors, ip: req.ip });
                        return res.status(400).json({
                            error: 'File validation failed',
                            details: result.errors
                        });
                    }
                }
                // Multiple files check
                if (req.files) {
                    const files = Array.isArray(req.files)
                        ? req.files
                        : Object.values(req.files).flat();
                    for (const file of files) {
                        const result = this.validateFileUpload(Object.assign({ file: file }, options));
                        if (!result.isValid) {
                            logger_service_1.logger.warn('File upload validation failed:', { errors: result.errors, ip: req.ip });
                            return res.status(400).json({
                                error: 'File validation failed',
                                details: result.errors
                            });
                        }
                    }
                }
                next();
            }
            catch (error) {
                logger_service_1.logger.error('File upload validation middleware error:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        };
    }
}
exports.SecurityValidator = SecurityValidator;
// Default instance
exports.securityValidator = new SecurityValidator();
//# sourceMappingURL=SecurityValidator.js.map