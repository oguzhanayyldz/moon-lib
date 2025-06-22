import { logger } from '../services/logger.service';

export enum SecurityEventType {
    RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
    BRUTE_FORCE_ATTEMPT = 'brute_force_attempt',
    XSS_ATTEMPT = 'xss_attempt',
    SQL_INJECTION_ATTEMPT = 'sql_injection_attempt',
    NOSQL_INJECTION_ATTEMPT = 'nosql_injection_attempt',
    CSRF_VIOLATION = 'csrf_violation',
    FILE_UPLOAD_VIOLATION = 'file_upload_violation',
    SUSPICIOUS_INPUT = 'suspicious_input',
    ACCOUNT_LOCKED = 'account_locked',
    SECURITY_SCAN_DETECTED = 'security_scan_detected',
    API_KEY_VIOLATION = 'api_key_violation'
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
    topOffendingIPs: Array<{ ip: string; count: number }>;
}

/**
 * Security Event Monitoring and Alerting System
 */
export class SecurityMonitor {
    private events: SecurityEvent[] = [];
    private readonly maxEvents: number;
    private readonly alertThresholds: Record<string, number>;
    private readonly monitoringEnabled: boolean;
    private readonly logLevel: 'error' | 'warn' | 'info' | 'debug';

    constructor(options: {
        maxEvents?: number;
        alertThresholds?: Record<string, number>;
        enabled?: boolean;
        logLevel?: 'error' | 'warn' | 'info' | 'debug';
    } = {}) {
        this.maxEvents = options.maxEvents || 1000;
        this.alertThresholds = {
            rate_limit_exceeded: 10,
            brute_force_attempt: 5,
            sql_injection_attempt: 1,
            xss_attempt: 1,
            nosql_injection_attempt: 1,
            file_upload_violation: 3,
            csrf_violation: 1,
            api_key_violation: 5,
            ...options.alertThresholds
        };
        this.monitoringEnabled = options.enabled !== false;
        this.logLevel = options.logLevel || 'warn';
    }

    /**
     * Record a security event
     */
    recordEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
        if (!this.monitoringEnabled) {
            return;
        }

        const fullEvent: SecurityEvent = {
            ...event,
            timestamp: new Date()
        };

        // Add to events array
        this.events.push(fullEvent);

        // Trim events if exceeding max
        if (this.events.length > this.maxEvents) {
            this.events = this.events.slice(-this.maxEvents);
        }

        // Log the event
        this.logEvent(fullEvent);

        // Check for alert conditions
        this.checkAlertConditions(fullEvent);
    }

    /**
     * Get security metrics
     */
    getMetrics(): SecurityMetrics {
        const eventsByType: Record<string, number> = {};
        const eventsBySeverity: Record<string, number> = {};
        const ipCounts: Record<string, number> = {};

        for (const event of this.events) {
            eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
            eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
            ipCounts[event.ip] = (ipCounts[event.ip] || 0) + 1;
        }

        const topOffendingIPs = Object.entries(ipCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([ip, count]) => ({ ip, count }));

        return {
            totalEvents: this.events.length,
            eventsByType,
            eventsBySeverity,
            uniqueIPs: Object.keys(ipCounts).length,
            lastEventTime: this.events.length > 0 ? this.events[this.events.length - 1].timestamp : undefined,
            topOffendingIPs
        };
    }

    /**
     * Get recent events
     */
    getRecentEvents(limit: number = 50): SecurityEvent[] {
        return this.events.slice(-limit).reverse();
    }

    /**
     * Get events by type
     */
    getEventsByType(type: SecurityEvent['type'], limit: number = 100): SecurityEvent[] {
        return this.events
            .filter(event => event.type === type)
            .slice(-limit);
    }

    /**
     * Get events by IP
     */
    getEventsByIP(ip: string, limit: number = 100): SecurityEvent[] {
        return this.events
            .filter(event => event.ip === ip)
            .slice(-limit);
    }

    /**
     * Clear all events
     */
    clearEvents(): void {
        this.events = [];
        logger.info('Security events cleared');
    }

    /**
     * Get security dashboard data
     */
    getDashboardData(): {
        metrics: SecurityMetrics;
        recentEvents: SecurityEvent[];
        activeThreats: Array<{ ip: string; threatLevel: string; events: number }>;
    } {
        const metrics = this.getMetrics();
        const recentEvents = this.getRecentEvents(20);
        
        // Calculate threat levels based on recent activity
        const ipActivity: Record<string, SecurityEvent[]> = {};
        const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        for (const event of this.events) {
            if (event.timestamp >= last24Hours) {
                if (!ipActivity[event.ip]) {
                    ipActivity[event.ip] = [];
                }
                ipActivity[event.ip].push(event);
            }
        }

        const activeThreats = Object.entries(ipActivity)
            .map(([ip, events]) => {
                const highSeverityEvents = events.filter(e => e.severity === 'high' || e.severity === 'critical').length;
                const totalEvents = events.length;
                
                let threatLevel = 'low';
                if (highSeverityEvents > 3 || totalEvents > 20) {
                    threatLevel = 'critical';
                } else if (highSeverityEvents > 1 || totalEvents > 10) {
                    threatLevel = 'high';
                } else if (totalEvents > 5) {
                    threatLevel = 'medium';
                }

                return { ip, threatLevel, events: totalEvents };
            })
            .filter(threat => threat.threatLevel !== 'low')
            .sort((a, b) => b.events - a.events);

        return {
            metrics,
            recentEvents,
            activeThreats
        };
    }

    private logEvent(event: SecurityEvent): void {
        const logMessage = `Security Event: ${event.type} from ${event.ip} on ${event.endpoint}`;
        const logContext = {
            type: event.type,
            severity: event.severity,
            ip: event.ip,
            endpoint: event.endpoint,
            method: event.method,
            serviceName: event.serviceName,
            details: event.details
        };

        switch (event.severity) {
            case 'critical':
                logger.error(logMessage, logContext);
                break;
            case 'high':
                logger.error(logMessage, logContext);
                break;
            case 'medium':
                logger.warn(logMessage, logContext);
                break;
            case 'low':
            default:
                if (this.logLevel === 'info' || this.logLevel === 'debug') {
                    logger.info(logMessage, logContext);
                }
                break;
        }
    }

    private checkAlertConditions(event: SecurityEvent): void {
        const threshold = this.alertThresholds[event.type];
        if (!threshold) return;

        // Count recent events of the same type from the same IP
        const recentWindow = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes
        const recentEvents = this.events.filter(e => 
            e.type === event.type && 
            e.ip === event.ip && 
            e.timestamp >= recentWindow
        );

        if (recentEvents.length >= threshold) {
            this.triggerAlert(event, recentEvents.length);
        }
    }

    private triggerAlert(event: SecurityEvent, eventCount: number): void {
        const alertMessage = `SECURITY ALERT: ${eventCount} ${event.type} events from IP ${event.ip} in the last 5 minutes`;
        
        logger.error(alertMessage, {
            alertType: 'security_threshold_exceeded',
            eventType: event.type,
            ip: event.ip,
            eventCount,
            threshold: this.alertThresholds[event.type],
            serviceName: event.serviceName,
            endpoint: event.endpoint
        });

        // External alerting integrations
        this.sendExternalAlert(event, eventCount, alertMessage);
    }

    /**
     * Send alerts to external systems (Slack, webhooks, etc.)
     */
    private async sendExternalAlert(event: SecurityEvent, eventCount: number, message: string): Promise<void> {
        try {
            // Slack webhook integration
            const slackWebhookUrl = process.env.SECURITY_SLACK_WEBHOOK_URL;
            if (slackWebhookUrl) {
                await this.sendSlackAlert(slackWebhookUrl, event, eventCount, message);
            }

            // Generic webhook integration
            const webhookUrl = process.env.SECURITY_WEBHOOK_URL;
            if (webhookUrl) {
                await this.sendWebhookAlert(webhookUrl, event, eventCount, message);
            }

            // Email alert integration
            const alertEmail = process.env.SECURITY_ALERT_EMAIL;
            if (alertEmail) {
                // Note: Email implementation would require email service integration
                logger.info('Email alert triggered for security event', {
                    email: alertEmail,
                    eventType: event.type,
                    ip: event.ip
                });
            }
        } catch (error) {
            logger.error('Failed to send external alert:', error);
        }
    }

    /**
     * Send alert to Slack
     */
    private async sendSlackAlert(webhookUrl: string, event: SecurityEvent, eventCount: number, message: string): Promise<void> {
        const slackPayload = {
            text: `🚨 Security Alert - ${event.serviceName}`,
            attachments: [
                {
                    color: this.getSlackColorBySeverity(event.severity),
                    fields: [
                        {
                            title: 'Event Type',
                            value: event.type,
                            short: true
                        },
                        {
                            title: 'IP Address',
                            value: event.ip,
                            short: true
                        },
                        {
                            title: 'Event Count',
                            value: eventCount.toString(),
                            short: true
                        },
                        {
                            title: 'Service',
                            value: event.serviceName,
                            short: true
                        },
                        {
                            title: 'Endpoint',
                            value: event.endpoint,
                            short: false
                        },
                        {
                            title: 'Details',
                            value: JSON.stringify(event.details, null, 2),
                            short: false
                        }
                    ],
                    footer: 'Moon Security Monitor',
                    ts: Math.floor(event.timestamp.getTime() / 1000)
                }
            ]
        };

        // Simple HTTP POST to Slack webhook
        // Note: In a real implementation, you'd use a proper HTTP client
        logger.info('Slack alert would be sent:', { webhookUrl, payload: slackPayload });
    }

    /**
     * Send alert to generic webhook
     */
    private async sendWebhookAlert(webhookUrl: string, event: SecurityEvent, eventCount: number, message: string): Promise<void> {
        const webhookPayload = {
            alertType: 'security_threshold_exceeded',
            message,
            event: {
                type: event.type,
                severity: event.severity,
                ip: event.ip,
                endpoint: event.endpoint,
                serviceName: event.serviceName,
                timestamp: event.timestamp.toISOString(),
                details: event.details
            },
            eventCount,
            threshold: this.alertThresholds[event.type]
        };

        // Simple HTTP POST to webhook
        logger.info('Webhook alert would be sent:', { webhookUrl, payload: webhookPayload });
    }

    /**
     * Get Slack color based on severity
     */
    private getSlackColorBySeverity(severity: string): string {
        switch (severity) {
            case 'critical': return 'danger';
            case 'high': return 'warning';
            case 'medium': return '#ff9500';
            case 'low': return 'good';
            default: return '#439FE0';
        }
    }

    /**
     * Get advanced security metrics for monitoring dashboards
     */
    getAdvancedMetrics(): {
        basic: SecurityMetrics;
        advanced: {
            attackPatterns: Array<{ pattern: string; count: number; lastSeen: Date }>;
            ipReputation: Array<{ ip: string; riskScore: number; eventTypes: string[] }>;
            timeBasedAnalysis: {
                hourlyDistribution: Record<number, number>;
                dailyTrends: Array<{ date: string; events: number }>;
                peakTimes: Array<{ hour: number; events: number }>;
            };
            serviceSecurity: Record<string, {
                totalEvents: number;
                criticalEvents: number;
                uniqueIPs: number;
                topEventTypes: Array<{ type: string; count: number }>;
            }>;
        };
    } {
        const basic = this.getMetrics();
        
        // Attack pattern analysis
        const attackPatterns = this.analyzeAttackPatterns();
        
        // IP reputation scoring
        const ipReputation = this.calculateIPReputation();
        
        // Time-based analysis
        const timeBasedAnalysis = this.analyzeTimePatterns();
        
        // Service-specific security metrics
        const serviceSecurity = this.analyzeServiceSecurity();

        return {
            basic,
            advanced: {
                attackPatterns,
                ipReputation,
                timeBasedAnalysis,
                serviceSecurity
            }
        };
    }

    /**
     * Analyze attack patterns
     */
    private analyzeAttackPatterns(): Array<{ pattern: string; count: number; lastSeen: Date }> {
        const patterns: Record<string, { count: number; lastSeen: Date }> = {};

        for (const event of this.events) {
            // Create pattern identifier
            const pattern = `${event.type}_${event.severity}`;
            
            if (!patterns[pattern]) {
                patterns[pattern] = { count: 0, lastSeen: event.timestamp };
            }
            
            patterns[pattern].count++;
            if (event.timestamp > patterns[pattern].lastSeen) {
                patterns[pattern].lastSeen = event.timestamp;
            }
        }

        return Object.entries(patterns)
            .map(([pattern, data]) => ({ pattern, ...data }))
            .sort((a, b) => b.count - a.count);
    }

    /**
     * Calculate IP reputation scores
     */
    private calculateIPReputation(): Array<{ ip: string; riskScore: number; eventTypes: string[] }> {
        const ipData: Record<string, { events: SecurityEvent[]; score: number }> = {};

        // Group events by IP
        for (const event of this.events) {
            if (!ipData[event.ip]) {
                ipData[event.ip] = { events: [], score: 0 };
            }
            ipData[event.ip].events.push(event);
        }

        // Calculate risk scores
        return Object.entries(ipData).map(([ip, data]) => {
            let riskScore = 0;
            const eventTypes = new Set<string>();

            for (const event of data.events) {
                eventTypes.add(event.type);
                
                // Score based on severity
                switch (event.severity) {
                    case 'critical': riskScore += 10; break;
                    case 'high': riskScore += 5; break;
                    case 'medium': riskScore += 2; break;
                    case 'low': riskScore += 1; break;
                }
            }

            // Normalize score (0-100)
            riskScore = Math.min(100, riskScore);

            return {
                ip,
                riskScore,
                eventTypes: Array.from(eventTypes)
            };
        }).sort((a, b) => b.riskScore - a.riskScore);
    }

    /**
     * Analyze time-based patterns
     */
    private analyzeTimePatterns(): {
        hourlyDistribution: Record<number, number>;
        dailyTrends: Array<{ date: string; events: number }>;
        peakTimes: Array<{ hour: number; events: number }>;
    } {
        const hourlyDistribution: Record<number, number> = {};
        const dailyTrends: Record<string, number> = {};

        // Initialize hourly distribution
        for (let i = 0; i < 24; i++) {
            hourlyDistribution[i] = 0;
        }

        for (const event of this.events) {
            const hour = event.timestamp.getHours();
            const date = event.timestamp.toISOString().split('T')[0];

            hourlyDistribution[hour]++;
            dailyTrends[date] = (dailyTrends[date] || 0) + 1;
        }

        // Calculate peak times
        const peakTimes = Object.entries(hourlyDistribution)
            .map(([hour, events]) => ({ hour: parseInt(hour), events }))
            .sort((a, b) => b.events - a.events)
            .slice(0, 5);

        return {
            hourlyDistribution,
            dailyTrends: Object.entries(dailyTrends)
                .map(([date, events]) => ({ date, events }))
                .sort((a, b) => a.date.localeCompare(b.date)),
            peakTimes
        };
    }

    /**
     * Analyze service-specific security metrics
     */
    private analyzeServiceSecurity(): Record<string, {
        totalEvents: number;
        criticalEvents: number;
        uniqueIPs: number;
        topEventTypes: Array<{ type: string; count: number }>;
    }> {
        const serviceData: Record<string, {
            events: SecurityEvent[];
            ips: Set<string>;
            eventTypes: Record<string, number>;
        }> = {};

        // Group events by service
        for (const event of this.events) {
            if (!serviceData[event.serviceName]) {
                serviceData[event.serviceName] = {
                    events: [],
                    ips: new Set(),
                    eventTypes: {}
                };
            }

            const service = serviceData[event.serviceName];
            service.events.push(event);
            service.ips.add(event.ip);
            service.eventTypes[event.type] = (service.eventTypes[event.type] || 0) + 1;
        }

        // Transform to final format
        const result: Record<string, any> = {};
        for (const [serviceName, data] of Object.entries(serviceData)) {
            const criticalEvents = data.events.filter(e => 
                e.severity === 'critical' || e.severity === 'high'
            ).length;

            const topEventTypes = Object.entries(data.eventTypes)
                .map(([type, count]) => ({ type, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            result[serviceName] = {
                totalEvents: data.events.length,
                criticalEvents,
                uniqueIPs: data.ips.size,
                topEventTypes
            };
        }

        return result;
    }
}

// Global security monitor instance
export const globalSecurityMonitor = new SecurityMonitor({
    enabled: process.env.SECURITY_ENABLE_MONITORING !== 'false',
    logLevel: (process.env.SECURITY_LOG_LEVEL || 'warn') as 'error' | 'warn' | 'info' | 'debug',
    maxEvents: parseInt(process.env.SECURITY_MAX_EVENTS || '1000'),
    alertThresholds: {
        rate_limit_exceeded: parseInt(process.env.SECURITY_ALERT_RATE_LIMIT || '10'),
        brute_force_attempt: parseInt(process.env.SECURITY_ALERT_BRUTE_FORCE || '5'),
        sql_injection_attempt: parseInt(process.env.SECURITY_ALERT_SQL_INJECTION || '1'),
        xss_attempt: parseInt(process.env.SECURITY_ALERT_XSS || '1'),
        nosql_injection_attempt: parseInt(process.env.SECURITY_ALERT_NOSQL_INJECTION || '1'),
        file_upload_violation: parseInt(process.env.SECURITY_ALERT_FILE_UPLOAD || '3'),
        csrf_violation: parseInt(process.env.SECURITY_ALERT_CSRF || '1'),
        api_key_violation: parseInt(process.env.SECURITY_ALERT_API_KEY || '5')
    }
});
