import { Request, Response, NextFunction } from 'express';
import { RedisClientType } from 'redis';
import { logger } from '../services/logger.service';
import crypto from 'crypto';

export interface CSRFConfig {
    secretKey: string;
    tokenExpiry: number; // seconds
    cookieName: string;
    headerName: string;
    skipRoutes: string[];
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
}

export interface CSRFTokenData {
    token: string;
    sessionId: string;
    userId?: string;
    issuedAt: number;
    expiresAt: number;
    serviceName: string;
}

/**
 * Enhanced CSRF Protection Service
 * 
 * Redis-based, cross-service CSRF token management
 * 
 * Usage:
 * ```typescript
 * import { CSRFService, redisWrapper } from '@xmoonx/moon-lib';
 * 
 * const csrfService = new CSRFService(redisWrapper.client, {
 *   secretKey: process.env.CSRF_SECRET,
 *   tokenExpiry: 3600,
 *   cookieName: '_csrf',
 *   headerName: 'x-csrf-token'
 * });
 * 
 * // Generate token endpoint
 * app.get('/api/csrf-token', csrfService.generateTokenEndpoint());
 * 
 * // Protect routes
 * app.use('/api/*', csrfService.protectionMiddleware());
 * ```
 */
export class CSRFService {
    private redisClient: RedisClientType;
    private config: Required<CSRFConfig>;

    constructor(redisClient: RedisClientType, config: Partial<CSRFConfig>) {
        this.redisClient = redisClient;
        this.config = {
            secretKey: process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production',
            tokenExpiry: 3600, // 1 hour
            cookieName: '_csrf',
            headerName: 'x-csrf-token',
            skipRoutes: ['/health', '/metrics'],
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            ...config
        };
    }

    /**
     * Generate CSRF token with Redis storage
     */
    async generateToken(req: Request, serviceName: string, userId?: string): Promise<string> {
        try {
            // Generate session ID from request or create new one
            const sessionId = this.extractSessionId(req) || this.generateSessionId();
            
            // Generate cryptographically secure token
            const token = this.generateSecureToken();
            
            const now = Date.now();
            const tokenData: CSRFTokenData = {
                token,
                sessionId,
                userId,
                issuedAt: now,
                expiresAt: now + (this.config.tokenExpiry * 1000),
                serviceName
            };

            // Store in Redis with expiry
            const key = `csrf:${sessionId}:${serviceName}`;
            await this.redisClient.setEx(
                key,
                this.config.tokenExpiry,
                JSON.stringify(tokenData)
            );

            // Store reverse lookup (token -> sessionId)
            const tokenKey = `csrf_token:${token}`;
            await this.redisClient.setEx(
                tokenKey,
                this.config.tokenExpiry,
                sessionId
            );

            logger.debug('CSRF token generated:', {
                sessionId,
                serviceName,
                userId,
                expiresAt: new Date(tokenData.expiresAt)
            });

            return token;
        } catch (error) {
            logger.error('CSRF token generation error:', error);
            throw new Error('Failed to generate CSRF token');
        }
    }

    /**
     * Validate CSRF token
     */
    async validateToken(token: string, req: Request, serviceName: string): Promise<boolean> {
        try {
            if (!token) {
                return false;
            }

            // Get session ID from token
            const tokenKey = `csrf_token:${token}`;
            const sessionId = await this.redisClient.get(tokenKey);
            
            if (!sessionId) {
                logger.warn('CSRF token not found in Redis:', { token: token.substring(0, 8) + '...' });
                return false;
            }

            // Get token data
            const key = `csrf:${sessionId}:${serviceName}`;
            const tokenDataStr = await this.redisClient.get(key);
            
            if (!tokenDataStr) {
                logger.warn('CSRF token data not found:', { sessionId, serviceName });
                return false;
            }

            const tokenData: CSRFTokenData = JSON.parse(tokenDataStr);

            // Validate token match
            if (tokenData.token !== token) {
                logger.warn('CSRF token mismatch:', { sessionId, serviceName });
                return false;
            }

            // Check expiry
            if (Date.now() > tokenData.expiresAt) {
                logger.warn('CSRF token expired:', { sessionId, serviceName, expiresAt: new Date(tokenData.expiresAt) });
                await this.cleanupExpiredToken(sessionId, serviceName, token);
                return false;
            }

            // Validate session consistency
            const requestSessionId = this.extractSessionId(req);
            if (requestSessionId && requestSessionId !== sessionId) {
                logger.warn('CSRF session ID mismatch:', { 
                    tokenSessionId: sessionId, 
                    requestSessionId,
                    serviceName 
                });
                return false;
            }

            return true;
        } catch (error) {
            logger.error('CSRF token validation error:', error);
            return false;
        }
    }

    /**
     * CSRF protection middleware
     */
    protectionMiddleware(serviceName: string) {
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                // Skip for GET, HEAD, OPTIONS requests
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
                    logger.warn('CSRF token missing:', {
                        ip: req.ip,
                        method: req.method,
                        url: req.url,
                        userAgent: req.headers['user-agent'],
                        serviceName
                    });

                    return res.status(403).json({
                        error: 'CSRF token required',
                        code: 'CSRF_TOKEN_MISSING'
                    });
                }

                // Validate token
                const isValid = await this.validateToken(csrfToken, req, serviceName);

                if (!isValid) {
                    logger.warn('CSRF token validation failed:', {
                        ip: req.ip,
                        method: req.method,
                        url: req.url,
                        token: csrfToken.substring(0, 8) + '...',
                        serviceName
                    });

                    return res.status(403).json({
                        error: 'Invalid CSRF token',
                        code: 'CSRF_TOKEN_INVALID'
                    });
                }

                next();
            } catch (error) {
                logger.error('CSRF protection middleware error:', error);
                res.status(500).json({ 
                    error: 'Internal server error',
                    code: 'CSRF_MIDDLEWARE_ERROR'
                });
            }
        };
    }

    /**
     * Generate token endpoint
     */
    generateTokenEndpoint(serviceName: string) {
        return async (req: Request, res: Response) => {
            try {
                const userId = (req as any).currentUser?.id;
                const token = await this.generateToken(req, serviceName, userId);
                
                // Set CSRF token in cookie
                res.cookie(this.config.cookieName, token, {
                    httpOnly: this.config.httpOnly,
                    secure: this.config.secure,
                    sameSite: this.config.sameSite,
                    maxAge: this.config.tokenExpiry * 1000
                });

                res.json({
                    csrfToken: token,
                    expiresIn: this.config.tokenExpiry,
                    headerName: this.config.headerName
                });
            } catch (error) {
                logger.error('CSRF token generation endpoint error:', error);
                res.status(500).json({ 
                    error: 'Failed to generate CSRF token',
                    code: 'CSRF_GENERATION_ERROR'
                });
            }
        };
    }

    /**
     * Refresh token endpoint
     */
    refreshTokenEndpoint(serviceName: string) {
        return async (req: Request, res: Response) => {
            try {
                // Validate current token first
                const currentToken = req.headers[this.config.headerName] as string;
                
                if (currentToken && await this.validateToken(currentToken, req, serviceName)) {
                    // Generate new token
                    const userId = (req as any).currentUser?.id;
                    const newToken = await this.generateToken(req, serviceName, userId);
                    
                    // Invalidate old token
                    await this.invalidateToken(currentToken);
                    
                    res.cookie(this.config.cookieName, newToken, {
                        httpOnly: this.config.httpOnly,
                        secure: this.config.secure,
                        sameSite: this.config.sameSite,
                        maxAge: this.config.tokenExpiry * 1000
                    });

                    res.json({
                        csrfToken: newToken,
                        expiresIn: this.config.tokenExpiry,
                        refreshed: true
                    });
                } else {
                    res.status(401).json({
                        error: 'Invalid current CSRF token',
                        code: 'CSRF_REFRESH_INVALID'
                    });
                }
            } catch (error) {
                logger.error('CSRF token refresh error:', error);
                res.status(500).json({ 
                    error: 'Failed to refresh CSRF token',
                    code: 'CSRF_REFRESH_ERROR'
                });
            }
        };
    }

    /**
     * Cross-service token validation endpoint
     */
    validateTokenEndpoint(serviceName: string) {
        return async (req: Request, res: Response) => {
            try {
                const { token, targetService } = req.body;
                
                if (!token || !targetService) {
                    return res.status(400).json({
                        error: 'Token and target service required',
                        code: 'CSRF_VALIDATE_MISSING_PARAMS'
                    });
                }

                const isValid = await this.validateToken(token, req, targetService);
                
                res.json({
                    valid: isValid,
                    serviceName: targetService,
                    timestamp: Date.now()
                });
            } catch (error) {
                logger.error('CSRF token validation endpoint error:', error);
                res.status(500).json({ 
                    error: 'Token validation failed',
                    code: 'CSRF_VALIDATE_ERROR'
                });
            }
        };
    }

    /**
     * Generate cryptographically secure token
     */
    private generateSecureToken(): string {
        const timestamp = Date.now().toString();
        const randomBytes = crypto.randomBytes(32);
        const payload = timestamp + randomBytes.toString('hex');
        
        // Create HMAC signature
        const hmac = crypto.createHmac('sha256', this.config.secretKey);
        hmac.update(payload);
        const signature = hmac.digest('hex');
        
        // Combine payload and signature
        return Buffer.from(payload + '.' + signature).toString('base64url');
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
        // Try to get from session
        const sessionId = (req as any).session?.id || 
                         (req as any).sessionID ||
                         req.cookies?.sessionId;
        
        return sessionId || null;
    }

    /**
     * Invalidate token
     */
    async invalidateToken(token: string): Promise<void> {
        try {
            const tokenKey = `csrf_token:${token}`;
            const sessionId = await this.redisClient.get(tokenKey);
            
            if (sessionId) {
                // Remove token key
                await this.redisClient.del(tokenKey);
                
                // Remove all service tokens for this session
                const pattern = `csrf:${sessionId}:*`;
                const keys = await this.redisClient.keys(pattern);
                
                if (keys.length > 0) {
                    await this.redisClient.del(keys);
                }
            }
        } catch (error) {
            logger.error('Token invalidation error:', error);
        }
    }

    /**
     * Cleanup expired token
     */
    private async cleanupExpiredToken(sessionId: string, serviceName: string, token: string): Promise<void> {
        try {
            const key = `csrf:${sessionId}:${serviceName}`;
            const tokenKey = `csrf_token:${token}`;
            
            await Promise.all([
                this.redisClient.del(key),
                this.redisClient.del(tokenKey)
            ]);
        } catch (error) {
            logger.error('Cleanup expired token error:', error);
        }
    }

    /**
     * Get token statistics
     */
    async getTokenStats(): Promise<{
        totalTokens: number;
        activeTokens: number;
        expiredTokens: number;
    }> {
        try {
            const tokenKeys = await this.redisClient.keys('csrf_token:*');
            const csrfKeys = await this.redisClient.keys('csrf:*');
            
            return {
                totalTokens: tokenKeys.length,
                activeTokens: csrfKeys.length,
                expiredTokens: Math.max(0, tokenKeys.length - csrfKeys.length)
            };
        } catch (error) {
            logger.error('Get token stats error:', error);
            return {
                totalTokens: 0,
                activeTokens: 0,
                expiredTokens: 0
            };
        }
    }
}
