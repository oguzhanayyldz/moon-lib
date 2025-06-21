"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityManager = void 0;
const logger_service_1 = require("../services/logger.service");
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
class SecurityManager {
    constructor(config, modules) {
        this.config = Object.assign({ enableInputValidation: true, enableRateLimit: true, enableBruteForceProtection: true, enableSecurityHeaders: true, enableFileUploadValidation: true, environment: process.env.NODE_ENV || 'development' }, config);
        this.modules = modules || {};
    }
    /**
     * Complete security middleware stack
     */
    fullSecurityMiddleware() {
        const middlewares = [];
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
        const middlewares = [];
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
    fileUploadSecurityMiddleware(options) {
        const middlewares = [];
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
        const middlewares = [];
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
        const middlewares = [];
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
        return (req, res, next) => {
            var _a, _b;
            try {
                // Skip CSRF for GET, HEAD, OPTIONS requests
                if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
                    return next();
                }
                // Skip CSRF for API requests with valid JWT token
                if ((_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.startsWith('Bearer ')) {
                    return next();
                }
                // Check for CSRF token in headers
                const csrfToken = req.headers['x-csrf-token'];
                const sessionToken = (_b = req.session) === null || _b === void 0 ? void 0 : _b.csrfToken;
                if (!csrfToken || !sessionToken || csrfToken !== sessionToken) {
                    logger_service_1.logger.warn('CSRF token validation failed:', {
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
            }
            catch (error) {
                logger_service_1.logger.error('CSRF protection middleware error:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        };
    }
    /**
     * Generate CSRF token
     */
    generateCSRFToken(req) {
        const crypto = require('crypto');
        const token = crypto.randomBytes(32).toString('hex');
        // Store in session
        if (req.session) {
            req.session.csrfToken = token;
        }
        return token;
    }
    /**
     * Get security status
     */
    async getSecurityStatus(ip) {
        try {
            const promises = [];
            if (this.modules.rateLimiter) {
                promises.push(this.modules.rateLimiter.getRateLimitStatus(ip, 'general'));
            }
            else {
                promises.push(Promise.resolve(null));
            }
            if (this.modules.bruteForceProtection) {
                promises.push(this.modules.bruteForceProtection.getStatus(ip));
                promises.push(this.modules.bruteForceProtection.getBlockedIPs());
            }
            else {
                promises.push(Promise.resolve(null));
                promises.push(Promise.resolve([]));
            }
            const [rateLimitStatus, bruteForceStatus, blockedIPs] = await Promise.all(promises);
            return {
                rateLimitStatus,
                bruteForceStatus,
                blockedIPs: blockedIPs || []
            };
        }
        catch (error) {
            logger_service_1.logger.error('Get security status error:', error);
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
    async emergencyReset() {
        try {
            const promises = [];
            if (this.modules.rateLimiter) {
                promises.push(this.modules.rateLimiter.resetRateLimit('*', '*'));
            }
            if (this.modules.bruteForceProtection) {
                promises.push(this.modules.bruteForceProtection.clearAll());
            }
            await Promise.all(promises);
            logger_service_1.logger.info('Emergency security reset completed');
        }
        catch (error) {
            logger_service_1.logger.error('Emergency security reset error:', error);
        }
    }
    /**
     * Unblock IP address
     */
    async unblockIP(ip) {
        try {
            const promises = [];
            if (this.modules.rateLimiter) {
                promises.push(this.modules.rateLimiter.resetRateLimit(ip, '*'));
            }
            if (this.modules.bruteForceProtection) {
                promises.push(this.modules.bruteForceProtection.unblockIP(ip));
            }
            await Promise.all(promises);
            logger_service_1.logger.info('IP unblocked:', { ip });
        }
        catch (error) {
            logger_service_1.logger.error('Unblock IP error:', error);
        }
    }
}
exports.SecurityManager = SecurityManager;
//# sourceMappingURL=SecurityManager.js.map