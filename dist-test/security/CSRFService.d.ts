import { Request, Response, NextFunction } from 'express';
import { RedisClientType } from 'redis';
export interface CSRFConfig {
    secretKey: string;
    tokenExpiry: number;
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
export declare class CSRFService {
    private redisClient;
    private config;
    constructor(redisClient: RedisClientType, config: Partial<CSRFConfig>);
    /**
     * Generate CSRF token with Redis storage
     */
    generateToken(req: Request, serviceName: string, userId?: string): Promise<string>;
    /**
     * Validate CSRF token
     */
    validateToken(token: string, req: Request, serviceName: string): Promise<boolean>;
    /**
     * CSRF protection middleware
     */
    protectionMiddleware(serviceName: string): (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
    /**
     * Generate token endpoint
     */
    generateTokenEndpoint(serviceName: string): (req: Request, res: Response) => Promise<void>;
    /**
     * Refresh token endpoint
     */
    refreshTokenEndpoint(serviceName: string): (req: Request, res: Response) => Promise<void>;
    /**
     * Cross-service token validation endpoint
     */
    validateTokenEndpoint(serviceName: string): (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Generate cryptographically secure token
     */
    private generateSecureToken;
    /**
     * Generate session ID
     */
    private generateSessionId;
    /**
     * Extract session ID from request
     */
    private extractSessionId;
    /**
     * Invalidate token
     */
    invalidateToken(token: string): Promise<void>;
    /**
     * Cleanup expired token
     */
    private cleanupExpiredToken;
    /**
     * Get token statistics
     */
    getTokenStats(): Promise<{
        totalTokens: number;
        activeTokens: number;
        expiredTokens: number;
    }>;
}
//# sourceMappingURL=CSRFService.d.ts.map