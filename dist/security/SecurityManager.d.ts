import { Request, Response, NextFunction } from 'express';
import { SecurityValidator } from './SecurityValidator';
import { RateLimiter } from './RateLimiter';
import { BruteForceProtection } from './BruteForceProtection';
import { SecurityHeaders } from './SecurityHeaders';
declare global {
    namespace Express {
        interface Request {
            file?: {
                fieldname: string;
                originalname: string;
                encoding: string;
                mimetype: string;
                size: number;
                filename?: string;
                path?: string;
                buffer?: Buffer;
            };
            files?: {
                [fieldname: string]: {
                    fieldname: string;
                    originalname: string;
                    encoding: string;
                    mimetype: string;
                    size: number;
                    filename?: string;
                    path?: string;
                    buffer?: Buffer;
                }[];
            } | {
                fieldname: string;
                originalname: string;
                encoding: string;
                mimetype: string;
                size: number;
                filename?: string;
                path?: string;
                buffer?: Buffer;
            }[];
        }
    }
}
export interface SecurityManagerConfig {
    enableInputValidation?: boolean;
    enableRateLimit?: boolean;
    enableBruteForceProtection?: boolean;
    enableSecurityHeaders?: boolean;
    enableFileUploadValidation?: boolean;
    environment?: 'development' | 'production' | 'test';
}
export interface SecurityModules {
    validator?: SecurityValidator;
    rateLimiter?: RateLimiter;
    bruteForceProtection?: BruteForceProtection;
    securityHeaders?: SecurityHeaders;
}
/**
 * SecurityManager provides centralized security orchestration for microservices.
 * Unlike other security modules, this is designed to work with already instantiated
 * security modules from the microservice.
 *
 * Usage:
 * ```typescript
 * const securityManager = new SecurityManager({
 *   enableInputValidation: true,
 *   enableRateLimit: true
 * }, {
 *   validator: myServiceSecurity.validator,
 *   rateLimiter: myServiceSecurity.rateLimiter,
 *   bruteForceProtection: myServiceSecurity.bruteForceProtection,
 *   securityHeaders: myServiceSecurity.securityHeaders
 * });
 * ```
 */
export declare class SecurityManager {
    private config;
    private modules;
    constructor(config?: SecurityManagerConfig, modules?: SecurityModules);
    /**
     * Complete security middleware stack
     */
    fullSecurityMiddleware(): ((req: Request, res: Response, next: NextFunction) => void)[];
    /**
     * Authentication security middleware (for login routes)
     */
    authSecurityMiddleware(): ((req: Request, res: Response, next: NextFunction) => void)[];
    /**
     * File upload security middleware
     */
    fileUploadSecurityMiddleware(options?: {
        maxSize?: number;
        allowedTypes?: string[];
    }): ((req: Request, res: Response, next: NextFunction) => void)[];
    /**
     * API endpoint security middleware
     */
    apiSecurityMiddleware(): ((req: Request, res: Response, next: NextFunction) => void)[];
    /**
     * Public endpoint security middleware (minimal security)
     */
    publicSecurityMiddleware(): ((req: Request, res: Response, next: NextFunction) => void)[];
    /**
     * CSRF protection middleware
     */
    csrfProtectionMiddleware(): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
    /**
     * Generate CSRF token
     */
    generateCSRFToken(req: Request): string;
    /**
     * Get security status
     */
    getSecurityStatus(ip: string): Promise<{
        rateLimitStatus: any;
        bruteForceStatus: any;
        blockedIPs: any[];
    }>;
    /**
     * Emergency security reset
     */
    emergencyReset(): Promise<void>;
    /**
     * Unblock IP address
     */
    unblockIP(ip: string): Promise<void>;
}
