export declare enum SecurityEventType {
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded",
    BRUTE_FORCE_ATTEMPT = "brute_force_attempt",
    XSS_ATTEMPT = "xss_attempt",
    SQL_INJECTION_ATTEMPT = "sql_injection_attempt",
    NOSQL_INJECTION_ATTEMPT = "nosql_injection_attempt",
    CSRF_VIOLATION = "csrf_violation",
    FILE_UPLOAD_VIOLATION = "file_upload_violation",
    SUSPICIOUS_INPUT = "suspicious_input",
    ACCOUNT_LOCKED = "account_locked",
    SECURITY_SCAN_DETECTED = "security_scan_detected",
    API_KEY_VIOLATION = "api_key_violation"
}
export interface SecurityEvent {
    type: SecurityEventType;
    severity: 'low' | 'medium' | 'high' | 'critical';
    ip: string;
    userAgent?: string;
    userId?: string;
    endpoint: string;
    method: string;
    timestamp: Date;
    details: Record<string, any>;
    serviceName: string;
    blocked: boolean;
}
export interface SecurityMetrics {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    uniqueIPs: number;
    lastEventTime?: Date;
    topOffendingIPs: Array<{
        ip: string;
        count: number;
    }>;
}
/**
 * Security Event Monitoring and Alerting System
 */
export declare class SecurityMonitor {
    private events;
    private readonly maxEvents;
    private readonly alertThresholds;
    private readonly monitoringEnabled;
    private readonly logLevel;
    constructor(options?: {
        maxEvents?: number;
        alertThresholds?: Record<string, number>;
        enabled?: boolean;
        logLevel?: 'error' | 'warn' | 'info' | 'debug';
    });
    /**
     * Record a security event
     */
    recordEvent(event: Omit<SecurityEvent, 'timestamp'>): void;
    /**
     * Get security metrics
     */
    getMetrics(): SecurityMetrics;
    /**
     * Get recent events
     */
    getRecentEvents(limit?: number): SecurityEvent[];
    /**
     * Get events by type
     */
    getEventsByType(type: SecurityEvent['type'], limit?: number): SecurityEvent[];
    /**
     * Get events by IP
     */
    getEventsByIP(ip: string, limit?: number): SecurityEvent[];
    /**
     * Clear all events
     */
    clearEvents(): void;
    /**
     * Get security dashboard data
     */
    getDashboardData(): {
        metrics: SecurityMetrics;
        recentEvents: SecurityEvent[];
        activeThreats: Array<{
            ip: string;
            threatLevel: string;
            events: number;
        }>;
    };
    private logEvent;
    private checkAlertConditions;
    private triggerAlert;
    /**
     * Send alerts to external systems (Slack, webhooks, etc.)
     */
    private sendExternalAlert;
    /**
     * Send alert to Slack
     */
    private sendSlackAlert;
    /**
     * Send alert to generic webhook
     */
    private sendWebhookAlert;
    /**
     * Get Slack color based on severity
     */
    private getSlackColorBySeverity;
    /**
     * Get advanced security metrics for monitoring dashboards
     */
    getAdvancedMetrics(): {
        basic: SecurityMetrics;
        advanced: {
            attackPatterns: Array<{
                pattern: string;
                count: number;
                lastSeen: Date;
            }>;
            ipReputation: Array<{
                ip: string;
                riskScore: number;
                eventTypes: string[];
            }>;
            timeBasedAnalysis: {
                hourlyDistribution: Record<number, number>;
                dailyTrends: Array<{
                    date: string;
                    events: number;
                }>;
                peakTimes: Array<{
                    hour: number;
                    events: number;
                }>;
            };
            serviceSecurity: Record<string, {
                totalEvents: number;
                criticalEvents: number;
                uniqueIPs: number;
                topEventTypes: Array<{
                    type: string;
                    count: number;
                }>;
            }>;
        };
    };
    /**
     * Analyze attack patterns
     */
    private analyzeAttackPatterns;
    /**
     * Calculate IP reputation scores
     */
    private calculateIPReputation;
    /**
     * Analyze time-based patterns
     */
    private analyzeTimePatterns;
    /**
     * Analyze service-specific security metrics
     */
    private analyzeServiceSecurity;
}
export declare const globalSecurityMonitor: SecurityMonitor;
//# sourceMappingURL=SecurityMonitor.d.ts.map