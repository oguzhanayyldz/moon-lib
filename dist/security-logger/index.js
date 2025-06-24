"use strict";
/**
 * Security Logger Module
 *
 * Centralized security logging functionality for Moon Project microservices.
 * Provides structured logging capabilities to replace console.error usage
 * and enable comprehensive security monitoring and alerting.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEventSeverity = exports.SecurityEventSeverity = exports.SecurityEventType = exports.trendyolSecurityLogger = exports.shopifySecurityLogger = exports.integrationSecurityLogger = exports.pricingSecurityLogger = exports.productsSecurityLogger = exports.inventorySecurityLogger = exports.ordersSecurityLogger = exports.catalogSecurityLogger = exports.authSecurityLogger = exports.createSecurityLogger = exports.SecurityLogger = void 0;
var SecurityLogger_1 = require("./SecurityLogger");
Object.defineProperty(exports, "SecurityLogger", { enumerable: true, get: function () { return SecurityLogger_1.SecurityLogger; } });
Object.defineProperty(exports, "createSecurityLogger", { enumerable: true, get: function () { return SecurityLogger_1.createSecurityLogger; } });
Object.defineProperty(exports, "authSecurityLogger", { enumerable: true, get: function () { return SecurityLogger_1.authSecurityLogger; } });
Object.defineProperty(exports, "catalogSecurityLogger", { enumerable: true, get: function () { return SecurityLogger_1.catalogSecurityLogger; } });
Object.defineProperty(exports, "ordersSecurityLogger", { enumerable: true, get: function () { return SecurityLogger_1.ordersSecurityLogger; } });
Object.defineProperty(exports, "inventorySecurityLogger", { enumerable: true, get: function () { return SecurityLogger_1.inventorySecurityLogger; } });
Object.defineProperty(exports, "productsSecurityLogger", { enumerable: true, get: function () { return SecurityLogger_1.productsSecurityLogger; } });
Object.defineProperty(exports, "pricingSecurityLogger", { enumerable: true, get: function () { return SecurityLogger_1.pricingSecurityLogger; } });
Object.defineProperty(exports, "integrationSecurityLogger", { enumerable: true, get: function () { return SecurityLogger_1.integrationSecurityLogger; } });
Object.defineProperty(exports, "shopifySecurityLogger", { enumerable: true, get: function () { return SecurityLogger_1.shopifySecurityLogger; } });
Object.defineProperty(exports, "trendyolSecurityLogger", { enumerable: true, get: function () { return SecurityLogger_1.trendyolSecurityLogger; } });
var SecurityEventTypes_1 = require("./SecurityEventTypes");
Object.defineProperty(exports, "SecurityEventType", { enumerable: true, get: function () { return SecurityEventTypes_1.SecurityEventType; } });
Object.defineProperty(exports, "SecurityEventSeverity", { enumerable: true, get: function () { return SecurityEventTypes_1.SecurityEventSeverity; } });
Object.defineProperty(exports, "getEventSeverity", { enumerable: true, get: function () { return SecurityEventTypes_1.getEventSeverity; } });
