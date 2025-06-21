import { Request, Response, NextFunction } from 'express';
import { SecurityValidator } from './SecurityValidator';
import { RateLimiter, createIPRateLimiter, createUserRateLimiter, createStrictRateLimiter } from './RateLimiter';
import { BruteForceProtection, createBruteForceProtection, createStrictBruteForceProtection } from './BruteForceProtection';
import { SecurityHeaders } from './SecurityHeaders';
import { logger } from '../services/logger.service';

// Extend Request interface to include file properties
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
export class SecurityManager {
    private config: SecurityManagerConfig;
    private modules: SecurityModules;

    constructor (config?: SecurityManagerConfig, modules?: SecurityModules) {
        this.config = {
            enableInputValidation: true,
            enableRateLimit: true,
            enableBruteForceProtection: true,
            enableSecurityHeaders: true,
            enableFileUploadValidation: true,
            environment: process.env.NODE_ENV as 'development' | 'production' | 'test' || 'development',
            ...config
        };

        this.modules = modules || {};
    }

    /**
     * Complete security middleware stack
     */
    fullSecurityMiddleware() {
        const middlewares: Array<(req: Request, res: Response, next: NextFunction) => void> = [];

        // Security headers (should be first)
        if (this.config.enableSecurityHeaders && this.modules.securityHeaders) {
            middlewares.push(this.modules.securityHeaders.middleware());
        }

        // Rate limiting
        if (this.config.enableRateLimit && this.modules.rateLimiter) {
            middlewares.push(this.modules.rateLimiter.middleware());
        }

        // Input validation
        if (this.config.enableInputValidation && this.modules.validator) {
            middlewares.push(this.modules.validator.validateRequest());
        }

        return middlewares;
    }

    /**
     * Authentication security middleware (for login routes)
     */
    authSecurityMiddleware() {
        const middlewares: Array<(req: Request, res: Response, next: NextFunction) => void> = [];

        // Security headers
        if (this.config.enableSecurityHeaders && this.modules.securityHeaders) {
            middlewares.push(this.modules.securityHeaders.middleware());
        }

        // Brute force protection (before login attempt)
        if (this.config.enableBruteForceProtection && this.modules.bruteForceProtection) {
            middlewares.push(this.modules.bruteForceProtection.loginProtection());
        }

        // Note: Strict rate limiting would need to be handled by the specific service
        // since we don't have access to the strict rate limiter instance here

        // Input validation
        if (this.config.enableInputValidation && this.modules.validator) {
            middlewares.push(this.modules.validator.validateRequest());
        }

        // Handle failed login responses (should be last)
        if (this.config.enableBruteForceProtection && this.modules.bruteForceProtection) {
            middlewares.push(this.modules.bruteForceProtection.handleFailedLogin());
        }

        return middlewares;
    }

    /**
     * File upload security middleware
     */
    fileUploadSecurityMiddleware(options?: { maxSize?: number; allowedTypes?: string[] }) {
        const middlewares: Array<(req: Request, res: Response, next: NextFunction) => void> = [];

        // Security headers
        if (this.config.enableSecurityHeaders && this.modules.securityHeaders) {
            middlewares.push(this.modules.securityHeaders.middleware());
        }

        // Rate limiting for file uploads
        if (this.config.enableRateLimit && this.modules.rateLimiter) {
            // Note: Custom rate limiting options would need to be pre-configured
            middlewares.push(this.modules.rateLimiter.middleware());
        }

        // File validation
        if (this.config.enableFileUploadValidation && this.modules.validator) {
            middlewares.push(this.modules.validator.validateFileUploadMiddleware(options));
        }

        return middlewares;
    }

    /**
     * API endpoint security middleware
     */
    apiSecurityMiddleware() {
        const middlewares: Array<(req: Request, res: Response, next: NextFunction) => void> = [];

        // Security headers
        if (this.config.enableSecurityHeaders && this.modules.securityHeaders) {
            middlewares.push(this.modules.securityHeaders.middleware());
        }

        // Rate limiting
        if (this.config.enableRateLimit && this.modules.rateLimiter) {
            middlewares.push(this.modules.rateLimiter.middleware());
        }

        // Input validation
        if (this.config.enableInputValidation && this.modules.validator) {
            middlewares.push(this.modules.validator.validateRequest());
        }

        return middlewares;
    }

    /**
     * Public endpoint security middleware (minimal security)
     */
    publicSecurityMiddleware() {
        const middlewares: Array<(req: Request, res: Response, next: NextFunction) => void> = [];

        // Security headers (always enabled for public endpoints)
        if (this.modules.securityHeaders) {
            middlewares.push(this.modules.securityHeaders.middleware());
        }

        // Basic rate limiting
        if (this.config.enableRateLimit && this.modules.rateLimiter) {
            middlewares.push(this.modules.rateLimiter.middleware());
        }

        return middlewares;
    }

    /**
     * CSRF protection middleware
     */
    csrfProtectionMiddleware() {
        return (req: Request, res: Response, next: NextFunction) => {
            try {
                // Skip CSRF for GET, HEAD, OPTIONS requests
                if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
                    return next();
                }

                // Skip CSRF for API requests with valid JWT token
                if (req.headers.authorization?.startsWith('Bearer ')) {
                    return next();
                }

                // Check for CSRF token in headers
                const csrfToken = req.headers['x-csrf-token'] as string;
                const sessionToken = (req as any).session?.csrfToken;

                if (!csrfToken || !sessionToken || csrfToken !== sessionToken) {
                    logger.warn('CSRF token validation failed:', {
                        ip: req.ip,
                        method: req.method,
                        url: req.url,
                        hasCSRFToken: !!csrfToken,
                        hasSessionToken: !!sessionToken
                    });

                    return res.status(403).json({
                        error: 'CSRF token validation failed'
                    });
                }

                next();
            } catch (error) {
                logger.error('CSRF protection middleware error:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        };
    }

    /**
     * Generate CSRF token
     */
    generateCSRFToken(req: Request): string {
        const crypto = require('crypto');
        const token = crypto.randomBytes(32).toString('hex');

        // Store in session
        if ((req as any).session) {
            (req as any).session.csrfToken = token;
        }

        return token;
    }

    /**
     * Get security status
     */
    async getSecurityStatus(ip: string): Promise<{
        rateLimitStatus: any;
        bruteForceStatus: any;
        blockedIPs: any[];
    }> {
        try {
            const promises = [];
            
            if (this.modules.rateLimiter) {
                promises.push(this.modules.rateLimiter.getRateLimitStatus(ip, 'general'));
            } else {
                promises.push(Promise.resolve(null));
            }
            
            if (this.modules.bruteForceProtection) {
                promises.push(this.modules.bruteForceProtection.getStatus(ip));
                promises.push(this.modules.bruteForceProtection.getBlockedIPs());
            } else {
                promises.push(Promise.resolve(null));
                promises.push(Promise.resolve([]));
            }

            const [rateLimitStatus, bruteForceStatus, blockedIPs] = await Promise.all(promises);

            return {
                rateLimitStatus,
                bruteForceStatus,
                blockedIPs: (blockedIPs as any[]) || []
            };
        } catch (error) {
            logger.error('Get security status error:', error);
            return {
                rateLimitStatus: null,
                bruteForceStatus: null,
                blockedIPs: []
            };
        }
    }

    /**
     * Emergency security reset
     */
    async emergencyReset(): Promise<void> {
        try {
            const promises = [];
            
            if (this.modules.rateLimiter) {
                promises.push(this.modules.rateLimiter.resetRateLimit('*', '*'));
            }
            
            if (this.modules.bruteForceProtection) {
                promises.push(this.modules.bruteForceProtection.clearAll());
            }

            await Promise.all(promises);
            logger.info('Emergency security reset completed');
        } catch (error) {
            logger.error('Emergency security reset error:', error);
        }
    }

    /**
     * Unblock IP address
     */
    async unblockIP(ip: string): Promise<void> {
        try {
            const promises = [];
            
            if (this.modules.rateLimiter) {
                promises.push(this.modules.rateLimiter.resetRateLimit(ip, '*'));
            }
            
            if (this.modules.bruteForceProtection) {
                promises.push(this.modules.bruteForceProtection.unblockIP(ip));
            }

            await Promise.all(promises);
            logger.info('IP unblocked:', { ip });
        } catch (error) {
            logger.error('Unblock IP error:', error);
        }
    }
}
