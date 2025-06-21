import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logger.service';

export interface SecurityHeadersConfig {
    enableCSP?: boolean;
    enableHSTS?: boolean;
    enableXFrameOptions?: boolean;
    enableXContentTypeOptions?: boolean;
    enableXSSProtection?: boolean;
    enableReferrerPolicy?: boolean;
    enablePermissionsPolicy?: boolean;
    csp?: {
        directives?: Record<string, string[]>;
        reportOnly?: boolean;
    };
    hsts?: {
        maxAge?: number;
        includeSubDomains?: boolean;
        preload?: boolean;
    };
}

export interface CORSConfig {
    origin?: string | string[] | boolean | ((origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void);
    methods?: string[];
    allowedHeaders?: string[];
    exposedHeaders?: string[];
    credentials?: boolean;
    maxAge?: number;
    optionsSuccessStatus?: number;
}

export class SecurityHeaders {
    private config: SecurityHeadersConfig;

    constructor (config?: SecurityHeadersConfig) {
        this.config = {
            enableCSP: true,
            enableHSTS: true,
            enableXFrameOptions: true,
            enableXContentTypeOptions: true,
            enableXSSProtection: true,
            enableReferrerPolicy: true,
            enablePermissionsPolicy: true,
            csp: {
                directives: {
                    'default-src': ["'self'"],
                    'script-src': ["'self'", "'unsafe-inline'"],
                    'style-src': ["'self'", "'unsafe-inline'"],
                    'img-src': ["'self'", "data:", "https:"],
                    'font-src': ["'self'", "https:"],
                    'connect-src': ["'self'"],
                    'frame-src': ["'none'"],
                    'object-src': ["'none'"],
                    'base-uri': ["'self'"],
                    'form-action': ["'self'"]
                },
                reportOnly: false
            },
            hsts: {
                maxAge: 31536000, // 1 year
                includeSubDomains: true,
                preload: true
            },
            ...config
        };
    }

    /**
     * Generate Content Security Policy header value
     */
    private generateCSPHeader(): string {
        if (!this.config.csp?.directives) {
            return "";
        }

        const directives = Object.entries(this.config.csp.directives)
            .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
            .join('; ');

        return directives;
    }

    /**
     * Generate HSTS header value
     */
    private generateHSTSHeader(): string {
        const { maxAge, includeSubDomains, preload } = this.config.hsts!;

        let header = `max-age=${maxAge}`;
        if (includeSubDomains) {
            header += '; includeSubDomains';
        }
        if (preload) {
            header += '; preload';
        }

        return header;
    }

    /**
     * Security headers middleware
     */
    middleware() {
        return (req: Request, res: Response, next: NextFunction) => {
            try {
                // Content Security Policy
                if (this.config.enableCSP) {
                    const cspHeader = this.generateCSPHeader();
                    if (cspHeader) {
                        const headerName = this.config.csp?.reportOnly
                            ? 'Content-Security-Policy-Report-Only'
                            : 'Content-Security-Policy';
                        res.setHeader(headerName, cspHeader);
                    }
                }

                // HTTP Strict Transport Security
                if (this.config.enableHSTS) {
                    const hstsHeader = this.generateHSTSHeader();
                    res.setHeader('Strict-Transport-Security', hstsHeader);
                }

                // X-Frame-Options
                if (this.config.enableXFrameOptions) {
                    res.setHeader('X-Frame-Options', 'DENY');
                }

                // X-Content-Type-Options
                if (this.config.enableXContentTypeOptions) {
                    res.setHeader('X-Content-Type-Options', 'nosniff');
                }

                // X-XSS-Protection
                if (this.config.enableXSSProtection) {
                    res.setHeader('X-XSS-Protection', '1; mode=block');
                }

                // Referrer Policy
                if (this.config.enableReferrerPolicy) {
                    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
                }

                // Permissions Policy
                if (this.config.enablePermissionsPolicy) {
                    res.setHeader('Permissions-Policy',
                        'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), speaker=()'
                    );
                }

                // Remove server information
                res.removeHeader('X-Powered-By');
                res.removeHeader('Server');

                next();
            } catch (error) {
                logger.error('Security headers middleware error:', error);
                next();
            }
        };
    }

    /**
     * CORS middleware
     */
    static corsMiddleware(corsConfig?: CORSConfig) {
        const defaultConfig: CORSConfig = {
            origin: false, // Disable CORS by default for security
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: [
                'Content-Type',
                'Authorization',
                'X-Requested-With',
                'Accept',
                'Origin'
            ],
            exposedHeaders: [
                'X-RateLimit-Limit',
                'X-RateLimit-Remaining',
                'X-RateLimit-Reset'
            ],
            credentials: false,
            maxAge: 86400, // 24 hours
            optionsSuccessStatus: 204
        };

        const config = { ...defaultConfig, ...corsConfig };

        return (req: Request, res: Response, next: NextFunction) => {
            try {
                const origin = req.headers.origin;

                // Handle origin
                if (config.origin) {
                    if (typeof config.origin === 'boolean') {
                        if (config.origin) {
                            res.setHeader('Access-Control-Allow-Origin', '*');
                        }
                    } else if (typeof config.origin === 'string') {
                        if (origin === config.origin) {
                            res.setHeader('Access-Control-Allow-Origin', config.origin);
                        }
                    } else if (Array.isArray(config.origin)) {
                        if (origin && config.origin.includes(origin)) {
                            res.setHeader('Access-Control-Allow-Origin', origin);
                        }
                    } else if (typeof config.origin === 'function') {
                        config.origin(origin, (err, allowed) => {
                            if (err) {
                                logger.error('CORS origin callback error:', err);
                                return next(err);
                            }
                            if (allowed && origin) {
                                res.setHeader('Access-Control-Allow-Origin', origin);
                            }
                            continueWithCORS();
                        });
                        return;
                    }
                }

                continueWithCORS();

                function continueWithCORS() {
                    // Handle methods
                    if (config.methods) {
                        res.setHeader('Access-Control-Allow-Methods', config.methods.join(', '));
                    }

                    // Handle headers
                    if (config.allowedHeaders) {
                        res.setHeader('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
                    }

                    // Handle exposed headers
                    if (config.exposedHeaders && config.exposedHeaders.length > 0) {
                        res.setHeader('Access-Control-Expose-Headers', config.exposedHeaders.join(', '));
                    }

                    // Handle credentials
                    if (config.credentials) {
                        res.setHeader('Access-Control-Allow-Credentials', 'true');
                    }

                    // Handle max age
                    if (config.maxAge) {
                        res.setHeader('Access-Control-Max-Age', config.maxAge.toString());
                    }

                    // Handle preflight requests
                    if (req.method === 'OPTIONS') {
                        res.status(config.optionsSuccessStatus || 204).end();
                        return;
                    }

                    next();
                }
            } catch (error) {
                logger.error('CORS middleware error:', error);
                next();
            }
        };
    }

    /**
     * Update CSP directives
     */
    updateCSP(directives: Record<string, string[]>): void {
        if (this.config.csp) {
            this.config.csp.directives = { ...this.config.csp.directives, ...directives };
        }
    }

    /**
     * Add CSP directive
     */
    addCSPDirective(directive: string, sources: string[]): void {
        if (this.config.csp?.directives) {
            if (this.config.csp.directives[directive]) {
                this.config.csp.directives[directive].push(...sources);
            } else {
                this.config.csp.directives[directive] = sources;
            }
        }
    }

    /**
     * Remove CSP directive
     */
    removeCSPDirective(directive: string): void {
        if (this.config.csp?.directives) {
            delete this.config.csp.directives[directive];
        }
    }
}

// Default instances
export const securityHeaders = new SecurityHeaders();

export const strictSecurityHeaders = new SecurityHeaders({
    enableCSP: true,
    enableHSTS: true,
    enableXFrameOptions: true,
    enableXContentTypeOptions: true,
    enableXSSProtection: true,
    enableReferrerPolicy: true,
    enablePermissionsPolicy: true,
    csp: {
        directives: {
            'default-src': ["'none'"],
            'script-src': ["'self'"],
            'style-src': ["'self'"],
            'img-src': ["'self'"],
            'font-src': ["'self'"],
            'connect-src': ["'self'"],
            'frame-src': ["'none'"],
            'object-src': ["'none'"],
            'base-uri': ["'none'"],
            'form-action': ["'self'"]
        },
        reportOnly: false
    }
});

export const developmentSecurityHeaders = new SecurityHeaders({
    enableCSP: true,
    enableHSTS: false, // Disable HSTS in development
    enableXFrameOptions: false,
    enableXContentTypeOptions: true,
    enableXSSProtection: true,
    enableReferrerPolicy: false,
    enablePermissionsPolicy: false,
    csp: {
        directives: {
            'default-src': ["'self'"],
            'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            'style-src': ["'self'", "'unsafe-inline'"],
            'img-src': ["'self'", "data:", "https:", "http:"],
            'font-src': ["'self'", "data:", "https:"],
            'connect-src': ["'self'", "ws:", "wss:"],
            'frame-src': ["'self'"],
            'object-src': ["'none'"],
            'base-uri': ["'self'"],
            'form-action': ["'self'"]
        },
        reportOnly: true // Use report-only mode in development
    }
});
