import { Request, Response, NextFunction } from 'express';
import { RedisClientType } from 'redis';
import { logger } from '../services/logger.service';
import crypto from 'crypto';

export interface UnifiedCSRFConfig {
    secretKey: string;
    tokenExpiry: number; // seconds
    cookieName: string;
    headerName: string;
    skipRoutes: string[];
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    allowedOrigins?: string[];
}

export interface UnifiedCSRFTokenData {
    token: string;
    sessionId: string;
    userId?: string;
    issuedAt: number;
    expiresAt: number;
    scope: 'global';
    validServices: string[];
}

/**
 * Unified CSRF Protection Service
 * 
 * Single CSRF token valid across ALL microservices
 * Redis-based, cross-service token management
 * 
 * Usage:
 * ```typescript
 * import { UnifiedCSRFService, redisWrapper } from '@xmoonx/moon-lib';
 * 
 * const unifiedCSRF = new UnifiedCSRFService(redisWrapper.client, {
 *   secretKey: process.env.CSRF_SECRET,
 *   tokenExpiry: 1800, // 30 minutes
 * });
 * 
 * // Auth service - token generation
 * app.get('/api/auth/csrf-token', unifiedCSRF.generateTokenEndpoint());
 * 
 * // All services - protection middleware
 * app.use('/api/*', unifiedCSRF.universalProtectionMiddleware());
 * ```
 */
export class UnifiedCSRFService {
    private redisClient: RedisClientType;
    private config: Required<UnifiedCSRFConfig>;

    constructor(redisClient: RedisClientType, config: Partial<UnifiedCSRFConfig>) {
        this.redisClient = redisClient;
        this.config = {
            secretKey: process.env.CSRF_SECRET || 'unified-csrf-secret-change-in-production',
            tokenExpiry: 1800, // 30 minutes
            cookieName: '_csrf_unified',
            headerName: 'x-csrf-token',
            skipRoutes: ['/health', '/metrics', '/api/health'],
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            allowedOrigins: ['http://localhost:3000', 'https://app.mooncommerce.io'],
            ...config
        };

        logger.info('UnifiedCSRFService initialized with global scope');
    }

    /**
     * Generate unified token valid for ALL services
     */
    async generateUnifiedToken(req: Request, userId?: string): Promise<{
        token: string;
        expiresIn: number;
        validServices: string[];
    }> {
        try {
            const sessionId = this.extractSessionId(req) || this.generateSessionId();
            const token = this.generateSecureToken();
            
            const now = Date.now();
            const tokenData: UnifiedCSRFTokenData = {
                token,
                sessionId,
                userId,
                issuedAt: now,
                expiresAt: now + (this.config.tokenExpiry * 1000),
                scope: 'global',
                validServices: ['auth', 'orders', 'catalog', 'inventory', 'products', 'pricing', 'integration']
            };

            // Store in Redis with unified key structure
            const key = `csrf:unified:${sessionId}:${token}`;
            await this.redisClient.setEx(
                key,
                this.config.tokenExpiry,
                JSON.stringify(tokenData)
            );

            // Store reverse lookup (token -> session)
            const tokenKey = `csrf_token:unified:${token}`;
            await this.redisClient.setEx(
                tokenKey,
                this.config.tokenExpiry,
                sessionId
            );

            logger.debug('Unified CSRF token generated:', {
                sessionId,
                userId,
                validServices: tokenData.validServices,
                expiresAt: new Date(tokenData.expiresAt)
            });

            return {
                token,
                expiresIn: this.config.tokenExpiry * 1000, // in milliseconds
                validServices: tokenData.validServices
            };
        } catch (error) {
            logger.error('Unified CSRF token generation error:', error);
            throw new Error('Failed to generate unified CSRF token');
        }
    }

    /**
     * Validate unified token for ANY service
     */
    async validateUnifiedToken(token: string, req: Request, serviceName?: string): Promise<boolean> {
        try {
            if (!token) {
                return false;
            }

            // Get session ID from token lookup
            const tokenKey = `csrf_token:unified:${token}`;
            const sessionId = await this.redisClient.get(tokenKey);
            
            if (!sessionId) {
                logger.warn('Unified CSRF token not found in Redis:', { 
                    token: token.substring(0, 8) + '...',
                    serviceName 
                });
                return false;
            }

            // Get token data
            const key = `csrf:unified:${sessionId}:${token}`;
            const tokenDataStr = await this.redisClient.get(key);
            
            if (!tokenDataStr) {
                logger.warn('Unified CSRF token data not found:', { sessionId, serviceName });
                return false;
            }

            const tokenData: UnifiedCSRFTokenData = JSON.parse(tokenDataStr);

            // Validate token match
            if (tokenData.token !== token) {
                logger.warn('Unified CSRF token mismatch:', { sessionId, serviceName });
                return false;
            }

            // Check expiry
            if (Date.now() > tokenData.expiresAt) {
                logger.warn('Unified CSRF token expired:', { 
                    sessionId, 
                    serviceName,
                    expiresAt: new Date(tokenData.expiresAt) 
                });
                await this.cleanupExpiredToken(sessionId, token);
                return false;
            }

            // Validate session consistency
            const requestSessionId = this.extractSessionId(req);
            if (requestSessionId && requestSessionId !== sessionId) {
                logger.warn('Unified CSRF session ID mismatch:', { 
                    tokenSessionId: sessionId, 
                    requestSessionId,
                    serviceName 
                });
                return false;
            }

            // Verify token integrity
            if (!this.verifyTokenIntegrity(token)) {
                logger.warn('Unified CSRF token integrity check failed:', { sessionId, serviceName });
                return false;
            }

            return true;
        } catch (error) {
            logger.error('Unified CSRF token validation error:', error);
            return false;
        }
    }

    /**
     * Universal protection middleware for ALL services
     */
    universalProtectionMiddleware() {
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                // Skip for safe methods
                if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
                    return next();
                }

                // Skip for whitelisted routes
                if (this.config.skipRoutes.some(route => req.path.includes(route))) {
                    return next();
                }

                // Skip for Bearer token authenticated requests (API calls)
                if (req.headers.authorization?.startsWith('Bearer ')) {
                    return next();
                }

                // Get CSRF token from header or body
                const csrfToken = req.headers[this.config.headerName] as string ||
                                req.body?._csrf ||
                                req.query?._csrf as string;

                if (!csrfToken) {
                    logger.warn('Unified CSRF token missing:', {
                        ip: req.ip,
                        method: req.method,
                        url: req.url,
                        userAgent: req.headers['user-agent']
                    });

                    return res.status(403).json({
                        error: 'CSRF token required',
                        code: 'CSRF_TOKEN_MISSING',
                        type: 'unified'
                    });
                }

                // Validate unified token
                const serviceName = this.extractServiceName(req);
                const isValid = await this.validateUnifiedToken(csrfToken, req, serviceName);

                if (!isValid) {
                    logger.warn('Unified CSRF token validation failed:', {
                        ip: req.ip,
                        method: req.method,
                        url: req.url,
                        token: csrfToken.substring(0, 8) + '...',
                        serviceName
                    });

                    return res.status(403).json({
                        error: 'Invalid CSRF token',
                        code: 'CSRF_TOKEN_INVALID',
                        type: 'unified'
                    });
                }

                next();
            } catch (error) {
                logger.error('Unified CSRF protection middleware error:', error);
                res.status(500).json({ 
                    error: 'Internal server error',
                    code: 'CSRF_MIDDLEWARE_ERROR',
                    type: 'unified'
                });
            }
        };
    }

    /**
     * Token generation endpoint for auth service
     */
    generateTokenEndpoint() {
        return async (req: Request, res: Response) => {
            try {
                const userId = (req as any).currentUser?.id;
                const result = await this.generateUnifiedToken(req, userId);
                
                // Set CSRF token in cookie
                res.cookie(this.config.cookieName, result.token, {
                    httpOnly: this.config.httpOnly,
                    secure: this.config.secure,
                    sameSite: this.config.sameSite,
                    maxAge: result.expiresIn
                });

                res.json({
                    token: result.token,
                    expiresIn: result.expiresIn,
                    scope: 'global',
                    validServices: result.validServices,
                    headerName: this.config.headerName,
                    type: 'unified'
                });
            } catch (error) {
                logger.error('Unified CSRF token generation endpoint error:', error);
                res.status(500).json({ 
                    error: 'Failed to generate unified CSRF token',
                    code: 'CSRF_GENERATION_ERROR',
                    type: 'unified'
                });
            }
        };
    }

    /**
     * Token refresh endpoint
     */
    refreshTokenEndpoint() {
        return async (req: Request, res: Response) => {
            try {
                const currentToken = req.headers[this.config.headerName] as string;
                
                if (currentToken && await this.validateUnifiedToken(currentToken, req)) {
                    const userId = (req as any).currentUser?.id;
                    const result = await this.generateUnifiedToken(req, userId);
                    
                    // Invalidate old token
                    await this.invalidateToken(currentToken);
                    
                    res.cookie(this.config.cookieName, result.token, {
                        httpOnly: this.config.httpOnly,
                        secure: this.config.secure,
                        sameSite: this.config.sameSite,
                        maxAge: result.expiresIn
                    });

                    res.json({
                        token: result.token,
                        expiresIn: result.expiresIn,
                        scope: 'global',
                        validServices: result.validServices,
                        refreshed: true,
                        type: 'unified'
                    });
                } else {
                    res.status(401).json({
                        error: 'Invalid current CSRF token',
                        code: 'CSRF_REFRESH_INVALID',
                        type: 'unified'
                    });
                }
            } catch (error) {
                logger.error('Unified CSRF token refresh error:', error);
                res.status(500).json({ 
                    error: 'Failed to refresh unified CSRF token',
                    code: 'CSRF_REFRESH_ERROR',
                    type: 'unified'
                });
            }
        };
    }

    /**
     * Generate cryptographically secure token with integrity
     */
    private generateSecureToken(): string {
        const timestamp = Date.now().toString();
        const randomBytes = crypto.randomBytes(32);
        const payload = timestamp + '.' + randomBytes.toString('hex');
        
        // Create HMAC signature for integrity
        const hmac = crypto.createHmac('sha256', this.config.secretKey);
        hmac.update(payload);
        const signature = hmac.digest('hex');
        
        // Combine payload and signature
        return Buffer.from(payload + '.' + signature).toString('base64url');
    }

    /**
     * Verify token integrity with HMAC
     */
    private verifyTokenIntegrity(token: string): boolean {
        try {
            const decoded = Buffer.from(token, 'base64url').toString();
            const parts = decoded.split('.');
            
            if (parts.length !== 3) {
                return false;
            }

            const [timestamp, randomPart, signature] = parts;
            const payload = timestamp + '.' + randomPart;
            
            const hmac = crypto.createHmac('sha256', this.config.secretKey);
            hmac.update(payload);
            const expectedSignature = hmac.digest('hex');
            
            return crypto.timingSafeEqual(
                Buffer.from(signature, 'hex'),
                Buffer.from(expectedSignature, 'hex')
            );
        } catch (error) {
            return false;
        }
    }

    /**
     * Generate session ID
     */
    private generateSessionId(): string {
        return crypto.randomBytes(16).toString('hex');
    }

    /**
     * Extract session ID from request
     */
    private extractSessionId(req: Request): string | null {
        return (req as any).session?.id || 
               (req as any).sessionID ||
               req.cookies?.sessionId ||
               null;
    }

    /**
     * Extract service name from request path
     */
    private extractServiceName(req: Request): string {
        const pathParts = req.path.split('/');
        if (pathParts.length >= 3 && pathParts[1] === 'api') {
            return pathParts[2]; // /api/orders -> orders
        }
        return 'unknown';
    }

    /**
     * Invalidate token
     */
    async invalidateToken(token: string): Promise<void> {
        try {
            const tokenKey = `csrf_token:unified:${token}`;
            const sessionId = await this.redisClient.get(tokenKey);
            
            if (sessionId) {
                const key = `csrf:unified:${sessionId}:${token}`;
                await Promise.all([
                    this.redisClient.del(key),
                    this.redisClient.del(tokenKey)
                ]);
            }
        } catch (error) {
            logger.error('Token invalidation error:', error);
        }
    }

    /**
     * Cleanup expired token
     */
    private async cleanupExpiredToken(sessionId: string, token: string): Promise<void> {
        try {
            const key = `csrf:unified:${sessionId}:${token}`;
            const tokenKey = `csrf_token:unified:${token}`;
            
            await Promise.all([
                this.redisClient.del(key),
                this.redisClient.del(tokenKey)
            ]);
        } catch (error) {
            logger.error('Cleanup expired token error:', error);
        }
    }

    /**
     * Get unified token statistics
     */
    async getUnifiedTokenStats(): Promise<{
        totalTokens: number;
        activeTokens: number;
        expiredTokens: number;
    }> {
        try {
            const tokenKeys = await this.redisClient.keys('csrf_token:unified:*');
            const csrfKeys = await this.redisClient.keys('csrf:unified:*');
            
            return {
                totalTokens: tokenKeys.length,
                activeTokens: csrfKeys.length,
                expiredTokens: Math.max(0, tokenKeys.length - csrfKeys.length)
            };
        } catch (error) {
            logger.error('Get unified token stats error:', error);
            return {
                totalTokens: 0,
                activeTokens: 0,
                expiredTokens: 0
            };
        }
    }
}
