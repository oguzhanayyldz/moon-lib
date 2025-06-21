import { Request, Response, NextFunction } from 'express';
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
export declare class SecurityHeaders {
    private config;
    constructor(config?: SecurityHeadersConfig);
    /**
     * Generate Content Security Policy header value
     */
    private generateCSPHeader;
    /**
     * Generate HSTS header value
     */
    private generateHSTSHeader;
    /**
     * Security headers middleware
     */
    middleware(): (req: Request, res: Response, next: NextFunction) => void;
    /**
     * CORS middleware
     */
    static corsMiddleware(corsConfig?: CORSConfig): (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Update CSP directives
     */
    updateCSP(directives: Record<string, string[]>): void;
    /**
     * Add CSP directive
     */
    addCSPDirective(directive: string, sources: string[]): void;
    /**
     * Remove CSP directive
     */
    removeCSPDirective(directive: string): void;
}
export declare const securityHeaders: SecurityHeaders;
export declare const strictSecurityHeaders: SecurityHeaders;
export declare const developmentSecurityHeaders: SecurityHeaders;
