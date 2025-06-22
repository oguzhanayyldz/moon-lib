"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityConfigManager = exports.SecurityConfigManager = void 0;
const logger_service_1 = require("../services/logger.service");
class SecurityConfigManager {
    constructor() {
        this.config = this.loadConfiguration();
    }
    static getInstance() {
        if (!SecurityConfigManager.instance) {
            SecurityConfigManager.instance = new SecurityConfigManager();
        }
        return SecurityConfigManager.instance;
    }
    /**
     * Load configuration from environment variables with defaults
     */
    loadConfiguration() {
        const config = {
            // File Upload Settings
            maxFileSize: this.getEnvNumber('SECURITY_MAX_FILE_SIZE', 10 * 1024 * 1024), // 10MB
            maxRequestSize: this.getEnvNumber('SECURITY_MAX_REQUEST_SIZE', 1024 * 1024), // 1MB
            allowedMimeTypes: this.getEnvArray('SECURITY_ALLOWED_MIME_TYPES', [
                'image/jpeg', 'image/png', 'image/gif', 'application/pdf'
            ]),
            allowedExtensions: this.getEnvArray('SECURITY_ALLOWED_EXTENSIONS', [
                '.jpg', '.jpeg', '.png', '.gif', '.pdf'
            ]),
            // Rate Limiting Settings
            rateLimitMaxRequests: this.getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100),
            rateLimitWindowMs: this.getEnvNumber('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000), // 15 minutes
            rateLimitUserMaxRequests: this.getEnvNumber('RATE_LIMIT_USER_MAX_REQUESTS', 1000),
            rateLimitApiKeyMaxRequests: this.getEnvNumber('RATE_LIMIT_API_KEY_MAX_REQUESTS', 5000),
            // Brute Force Protection Settings
            bruteForceMaxAttempts: this.getEnvNumber('BRUTE_FORCE_MAX_ATTEMPTS', 5),
            bruteForceWindowSeconds: this.getEnvNumber('BRUTE_FORCE_WINDOW_SECONDS', 15 * 60), // 15 minutes
            bruteForceLockoutDurationSeconds: this.getEnvNumber('BRUTE_FORCE_LOCKOUT_DURATION_SECONDS', 30 * 60), // 30 minutes
            // Security Features Toggle
            enableXSSProtection: this.getEnvBoolean('SECURITY_ENABLE_XSS_PROTECTION', true),
            enableSQLInjectionDetection: this.getEnvBoolean('SECURITY_ENABLE_SQL_INJECTION_DETECTION', true),
            enableNoSQLInjectionDetection: this.getEnvBoolean('SECURITY_ENABLE_NOSQL_INJECTION_DETECTION', true),
            enableCSRFProtection: this.getEnvBoolean('SECURITY_ENABLE_CSRF_PROTECTION', false), // Default false for API services
            enableSecurityHeaders: this.getEnvBoolean('SECURITY_ENABLE_HEADERS', true),
            enableFileUploadValidation: this.getEnvBoolean('SECURITY_ENABLE_FILE_UPLOAD_VALIDATION', true),
            // CSRF Settings
            csrfSecret: this.getEnvString('CSRF_SECRET', 'default-csrf-secret-change-in-production'),
            csrfCookieName: this.getEnvString('CSRF_COOKIE_NAME', '_csrf'),
            csrfHeaderName: this.getEnvString('CSRF_HEADER_NAME', 'x-csrf-token'),
            // Security Headers Settings
            enableCSP: this.getEnvBoolean('SECURITY_ENABLE_CSP', true),
            enableHSTS: this.getEnvBoolean('SECURITY_ENABLE_HSTS', true),
            enableXFrameOptions: this.getEnvBoolean('SECURITY_ENABLE_X_FRAME_OPTIONS', true),
            enableXContentTypeOptions: this.getEnvBoolean('SECURITY_ENABLE_X_CONTENT_TYPE_OPTIONS', true),
            // Monitoring Settings
            enableSecurityLogging: this.getEnvBoolean('SECURITY_ENABLE_LOGGING', true),
            securityLogLevel: this.getEnvString('SECURITY_LOG_LEVEL', 'warn'),
            enableSecurityMetrics: this.getEnvBoolean('SECURITY_ENABLE_METRICS', true)
        };
        this.validateConfiguration(config);
        return config;
    }
    /**
     * Get configuration for a specific service
     */
    getServiceConfig(serviceName) {
        // Service-specific overrides can be added here
        const baseConfig = Object.assign({}, this.config);
        // Service-specific configurations
        switch (serviceName.toLowerCase()) {
            case 'auth':
                baseConfig.rateLimitMaxRequests = this.getEnvNumber('AUTH_RATE_LIMIT_MAX_REQUESTS', 100);
                baseConfig.bruteForceMaxAttempts = this.getEnvNumber('AUTH_BRUTE_FORCE_MAX_ATTEMPTS', 5);
                baseConfig.enableCSRFProtection = this.getEnvBoolean('AUTH_ENABLE_CSRF_PROTECTION', true);
                break;
            case 'orders':
                baseConfig.rateLimitMaxRequests = this.getEnvNumber('ORDERS_RATE_LIMIT_MAX_REQUESTS', 200);
                baseConfig.bruteForceMaxAttempts = this.getEnvNumber('ORDERS_BRUTE_FORCE_MAX_ATTEMPTS', 10);
                baseConfig.maxFileSize = this.getEnvNumber('ORDERS_MAX_FILE_SIZE', 20 * 1024 * 1024); // 20MB
                break;
            case 'products':
                baseConfig.rateLimitMaxRequests = this.getEnvNumber('PRODUCTS_RATE_LIMIT_MAX_REQUESTS', 300);
                baseConfig.maxFileSize = this.getEnvNumber('PRODUCTS_MAX_FILE_SIZE', 50 * 1024 * 1024); // 50MB for product images
                break;
            default:
                // Default configuration for other services
                break;
        }
        return baseConfig;
    }
    /**
     * Reload configuration (useful for runtime updates)
     */
    reloadConfiguration() {
        this.config = this.loadConfiguration();
        logger_service_1.logger.info('Security configuration reloaded');
    }
    /**
     * Get current configuration
     */
    getConfiguration() {
        return Object.assign({}, this.config);
    }
    // Helper methods for environment variable parsing
    getEnvString(key, defaultValue) {
        return process.env[key] || defaultValue;
    }
    getEnvNumber(key, defaultValue) {
        const value = process.env[key];
        if (value === undefined)
            return defaultValue;
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? defaultValue : parsed;
    }
    getEnvBoolean(key, defaultValue) {
        const value = process.env[key];
        if (value === undefined)
            return defaultValue;
        return value.toLowerCase() === 'true';
    }
    getEnvArray(key, defaultValue) {
        const value = process.env[key];
        if (value === undefined)
            return defaultValue;
        return value.split(',').map(item => item.trim());
    }
    /**
     * Validate configuration values
     */
    validateConfiguration(config) {
        const errors = [];
        // Validate numeric values
        if (config.maxFileSize <= 0) {
            errors.push('maxFileSize must be greater than 0');
        }
        if (config.rateLimitMaxRequests <= 0) {
            errors.push('rateLimitMaxRequests must be greater than 0');
        }
        if (config.bruteForceMaxAttempts <= 0) {
            errors.push('bruteForceMaxAttempts must be greater than 0');
        }
        // Validate arrays
        if (config.allowedMimeTypes.length === 0) {
            errors.push('allowedMimeTypes cannot be empty');
        }
        if (config.allowedExtensions.length === 0) {
            errors.push('allowedExtensions cannot be empty');
        }
        // Validate CSRF secret in production
        if (process.env.NODE_ENV === 'production' && config.csrfSecret === 'default-csrf-secret-change-in-production') {
            errors.push('CSRF secret must be changed in production environment');
        }
        if (errors.length > 0) {
            logger_service_1.logger.error('Security configuration validation failed:', errors);
            throw new Error(`Security configuration validation failed: ${errors.join(', ')}`);
        }
        logger_service_1.logger.info('Security configuration validated successfully');
    }
    /**
     * Get configuration summary for logging
     */
    getConfigurationSummary() {
        return {
            maxFileSize: this.config.maxFileSize,
            rateLimitMaxRequests: this.config.rateLimitMaxRequests,
            rateLimitWindowMs: this.config.rateLimitWindowMs,
            bruteForceMaxAttempts: this.config.bruteForceMaxAttempts,
            enabledFeatures: {
                xssProtection: this.config.enableXSSProtection,
                sqlInjectionDetection: this.config.enableSQLInjectionDetection,
                nosqlInjectionDetection: this.config.enableNoSQLInjectionDetection,
                csrfProtection: this.config.enableCSRFProtection,
                securityHeaders: this.config.enableSecurityHeaders,
                fileUploadValidation: this.config.enableFileUploadValidation
            }
        };
    }
}
exports.SecurityConfigManager = SecurityConfigManager;
// Export singleton instance
exports.securityConfigManager = SecurityConfigManager.getInstance();
