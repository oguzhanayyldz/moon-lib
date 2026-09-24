"use strict";
/**
 * Metrics Module
 *
 * Centralized metrics collection for event processing, monitoring, and observability.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OwnershipMetrics = exports.EventMetrics = void 0;
var EventMetrics_1 = require("./EventMetrics");
Object.defineProperty(exports, "EventMetrics", { enumerable: true, get: function () { return EventMetrics_1.EventMetrics; } });
var OwnershipMetrics_1 = require("./OwnershipMetrics");
Object.defineProperty(exports, "OwnershipMetrics", { enumerable: true, get: function () { return OwnershipMetrics_1.OwnershipMetrics; } });
