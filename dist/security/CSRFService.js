"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CSRFService = void 0;
const logger_service_1 = require("../services/logger.service");
const crypto_1 = __importDefault(require("crypto"));
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
class CSRFService {
    constructor(redisClient, config) {
        this.redisClient = redisClient;
        this.config = Object.assign({ secretKey: process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production', tokenExpiry: 3600, cookieName: '_csrf', headerName: 'x-csrf-token', skipRoutes: ['/health', '/metrics'], httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' }, config);
    }
    /**
     * Generate CSRF token with Redis storage
     */
    generateToken(req, serviceName, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Generate session ID from request or create new one
                const sessionId = this.extractSessionId(req) || this.generateSessionId();
                // Generate cryptographically secure token
                const token = this.generateSecureToken();
                const now = Date.now();
                const tokenData = {
                    token,
                    sessionId,
                    userId,
                    issuedAt: now,
                    expiresAt: now + (this.config.tokenExpiry * 1000),
                    serviceName
                };
                // Store in Redis with expiry
                const key = `csrf:${sessionId}:${serviceName}`;
                yield this.redisClient.setEx(key, this.config.tokenExpiry, JSON.stringify(tokenData));
                // Store reverse lookup (token -> sessionId)
                const tokenKey = `csrf_token:${token}`;
                yield this.redisClient.setEx(tokenKey, this.config.tokenExpiry, sessionId);
                logger_service_1.logger.debug('CSRF token generated:', {
                    sessionId,
                    serviceName,
                    userId,
                    expiresAt: new Date(tokenData.expiresAt)
                });
                return token;
            }
            catch (error) {
                logger_service_1.logger.error('CSRF token generation error:', error);
                throw new Error('Failed to generate CSRF token');
            }
        });
    }
    /**
     * Validate CSRF token
     */
    validateToken(token, req, serviceName) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!token) {
                    return false;
                }
                // Get session ID from token
                const tokenKey = `csrf_token:${token}`;
                const sessionId = yield this.redisClient.get(tokenKey);
                if (!sessionId) {
                    logger_service_1.logger.warn('CSRF token not found in Redis:', { token: token.substring(0, 8) + '...' });
                    return false;
                }
                // Get token data
                const key = `csrf:${sessionId}:${serviceName}`;
                const tokenDataStr = yield this.redisClient.get(key);
                if (!tokenDataStr) {
                    logger_service_1.logger.warn('CSRF token data not found:', { sessionId, serviceName });
                    return false;
                }
                const tokenData = JSON.parse(tokenDataStr);
                // Validate token match
                if (tokenData.token !== token) {
                    logger_service_1.logger.warn('CSRF token mismatch:', { sessionId, serviceName });
                    return false;
                }
                // Check expiry
                if (Date.now() > tokenData.expiresAt) {
                    logger_service_1.logger.warn('CSRF token expired:', { sessionId, serviceName, expiresAt: new Date(tokenData.expiresAt) });
                    yield this.cleanupExpiredToken(sessionId, serviceName, token);
                    return false;
                }
                // Validate session consistency
                const requestSessionId = this.extractSessionId(req);
                if (requestSessionId && requestSessionId !== sessionId) {
                    logger_service_1.logger.warn('CSRF session ID mismatch:', {
                        tokenSessionId: sessionId,
                        requestSessionId,
                        serviceName
                    });
                    return false;
                }
                return true;
            }
            catch (error) {
                logger_service_1.logger.error('CSRF token validation error:', error);
                return false;
            }
        });
    }
    /**
     * CSRF protection middleware
     */
    protectionMiddleware(serviceName) {
        return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
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
                if ((_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.startsWith('Bearer ')) {
                    return next();
                }
                // Get CSRF token from header or body
                const csrfToken = req.headers[this.config.headerName] ||
                    ((_b = req.body) === null || _b === void 0 ? void 0 : _b._csrf) ||
                    ((_c = req.query) === null || _c === void 0 ? void 0 : _c._csrf);
                if (!csrfToken) {
                    logger_service_1.logger.warn('CSRF token missing:', {
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
                const isValid = yield this.validateToken(csrfToken, req, serviceName);
                if (!isValid) {
                    logger_service_1.logger.warn('CSRF token validation failed:', {
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
            }
            catch (error) {
                logger_service_1.logger.error('CSRF protection middleware error:', error);
                res.status(500).json({
                    error: 'Internal server error',
                    code: 'CSRF_MIDDLEWARE_ERROR'
                });
            }
        });
    }
    /**
     * Generate token endpoint
     */
    generateTokenEndpoint(serviceName) {
        return (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const userId = (_a = req.currentUser) === null || _a === void 0 ? void 0 : _a.id;
                const token = yield this.generateToken(req, serviceName, userId);
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
            }
            catch (error) {
                logger_service_1.logger.error('CSRF token generation endpoint error:', error);
                res.status(500).json({
                    error: 'Failed to generate CSRF token',
                    code: 'CSRF_GENERATION_ERROR'
                });
            }
        });
    }
    /**
     * Refresh token endpoint
     */
    refreshTokenEndpoint(serviceName) {
        return (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                // Validate current token first
                const currentToken = req.headers[this.config.headerName];
                if (currentToken && (yield this.validateToken(currentToken, req, serviceName))) {
                    // Generate new token
                    const userId = (_a = req.currentUser) === null || _a === void 0 ? void 0 : _a.id;
                    const newToken = yield this.generateToken(req, serviceName, userId);
                    // Invalidate old token
                    yield this.invalidateToken(currentToken);
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
                }
                else {
                    res.status(401).json({
                        error: 'Invalid current CSRF token',
                        code: 'CSRF_REFRESH_INVALID'
                    });
                }
            }
            catch (error) {
                logger_service_1.logger.error('CSRF token refresh error:', error);
                res.status(500).json({
                    error: 'Failed to refresh CSRF token',
                    code: 'CSRF_REFRESH_ERROR'
                });
            }
        });
    }
    /**
     * Cross-service token validation endpoint
     */
    validateTokenEndpoint(serviceName) {
        return (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { token, targetService } = req.body;
                if (!token || !targetService) {
                    return res.status(400).json({
                        error: 'Token and target service required',
                        code: 'CSRF_VALIDATE_MISSING_PARAMS'
                    });
                }
                const isValid = yield this.validateToken(token, req, targetService);
                res.json({
                    valid: isValid,
                    serviceName: targetService,
                    timestamp: Date.now()
                });
            }
            catch (error) {
                logger_service_1.logger.error('CSRF token validation endpoint error:', error);
                res.status(500).json({
                    error: 'Token validation failed',
                    code: 'CSRF_VALIDATE_ERROR'
                });
            }
        });
    }
    /**
     * Generate cryptographically secure token
     */
    generateSecureToken() {
        const timestamp = Date.now().toString();
        const randomBytes = crypto_1.default.randomBytes(32);
        const payload = timestamp + randomBytes.toString('hex');
        // Create HMAC signature
        const hmac = crypto_1.default.createHmac('sha256', this.config.secretKey);
        hmac.update(payload);
        const signature = hmac.digest('hex');
        // Combine payload and signature
        return Buffer.from(payload + '.' + signature).toString('base64url');
    }
    /**
     * Generate session ID
     */
    generateSessionId() {
        return crypto_1.default.randomBytes(16).toString('hex');
    }
    /**
     * Extract session ID from request
     */
    extractSessionId(req) {
        var _a, _b;
        // Try to get from session
        const sessionId = ((_a = req.session) === null || _a === void 0 ? void 0 : _a.id) ||
            req.sessionID ||
            ((_b = req.cookies) === null || _b === void 0 ? void 0 : _b.sessionId);
        return sessionId || null;
    }
    /**
     * Invalidate token
     */
    invalidateToken(token) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const tokenKey = `csrf_token:${token}`;
                const sessionId = yield this.redisClient.get(tokenKey);
                if (sessionId) {
                    // Remove token key
                    yield this.redisClient.del(tokenKey);
                    // Remove all service tokens for this session
                    const pattern = `csrf:${sessionId}:*`;
                    const keys = yield this.redisClient.keys(pattern);
                    if (keys.length > 0) {
                        yield this.redisClient.del(keys);
                    }
                }
            }
            catch (error) {
                logger_service_1.logger.error('Token invalidation error:', error);
            }
        });
    }
    /**
     * Cleanup expired token
     */
    cleanupExpiredToken(sessionId, serviceName, token) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const key = `csrf:${sessionId}:${serviceName}`;
                const tokenKey = `csrf_token:${token}`;
                yield Promise.all([
                    this.redisClient.del(key),
                    this.redisClient.del(tokenKey)
                ]);
            }
            catch (error) {
                logger_service_1.logger.error('Cleanup expired token error:', error);
            }
        });
    }
    /**
     * Get token statistics
     */
    getTokenStats() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const tokenKeys = yield this.redisClient.keys('csrf_token:*');
                const csrfKeys = yield this.redisClient.keys('csrf:*');
                return {
                    totalTokens: tokenKeys.length,
                    activeTokens: csrfKeys.length,
                    expiredTokens: Math.max(0, tokenKeys.length - csrfKeys.length)
                };
            }
            catch (error) {
                logger_service_1.logger.error('Get token stats error:', error);
                return {
                    totalTokens: 0,
                    activeTokens: 0,
                    expiredTokens: 0
                };
            }
        });
    }
}
exports.CSRFService = CSRFService;
