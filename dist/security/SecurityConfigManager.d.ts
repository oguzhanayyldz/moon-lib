/**
 * Security Configuration Manager
 * Manages environment-based security configurations
 */
export interface SecurityEnvironmentConfig {
    maxFileSize: number;
    maxRequestSize: number;
    allowedMimeTypes: string[];
    allowedExtensions: string[];
    rateLimitMaxRequests: number;
    rateLimitWindowMs: number;
    rateLimitUserMaxRequests: number;
    rateLimitApiKeyMaxRequests: number;
    bruteForceMaxAttempts: number;
    bruteForceWindowSeconds: number;
    bruteForceLockoutDurationSeconds: number;
    enableXSSProtection: boolean;
    enableSQLInjectionDetection: boolean;
    enableNoSQLInjectionDetection: boolean;
    enableCSRFProtection: boolean;
    enableSecurityHeaders: boolean;
    enableFileUploadValidation: boolean;
    csrfSecret: string;
    csrfCookieName: string;
    csrfHeaderName: string;
    enableCSP: boolean;
    enableHSTS: boolean;
    enableXFrameOptions: boolean;
    enableXContentTypeOptions: boolean;
    enableSecurityLogging: boolean;
    securityLogLevel: 'info' | 'warn' | 'error';
    enableSecurityMetrics: boolean;
}
export declare class SecurityConfigManager {
    private static instance;
    private config;
    private constructor();
    static getInstance(): SecurityConfigManager;
    /**
     * Load configuration from environment variables with defaults
     */
    private loadConfiguration;
    /**
     * Get configuration for a specific service
     */
    getServiceConfig(serviceName: string): SecurityEnvironmentConfig;
    /**
     * Reload configuration (useful for runtime updates)
     */
    reloadConfiguration(): void;
    /**
     * Get current configuration
     */
    getConfiguration(): SecurityEnvironmentConfig;
    private getEnvString;
    private getEnvNumber;
    private getEnvBoolean;
    private getEnvArray;
    /**
     * Validate configuration values
     */
    private validateConfiguration;
    /**
     * Get configuration summary for logging
     */
    getConfigurationSummary(): object;
}
export declare const securityConfigManager: SecurityConfigManager;
