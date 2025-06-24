/**
 * Security Logger Module
 *
 * Centralized security logging functionality for Moon Project microservices.
 * Provides structured logging capabilities to replace console.error usage
 * and enable comprehensive security monitoring and alerting.
 */
export { SecurityLogger, createSecurityLogger, authSecurityLogger, catalogSecurityLogger, ordersSecurityLogger, inventorySecurityLogger, productsSecurityLogger, pricingSecurityLogger, integrationSecurityLogger, shopifySecurityLogger, trendyolSecurityLogger } from './SecurityLogger';
export { SecurityEventType, SecurityEventSeverity, SecurityEventMetadata, SecurityLogEntry, SecurityMetricsData, getEventSeverity } from './SecurityEventTypes';
