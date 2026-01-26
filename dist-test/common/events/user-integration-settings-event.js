"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShipmentScheduleFrequency = exports.ShipmentAutomationTrigger = void 0;
// =====================================
// Shipment Settings Types
// =====================================
/**
 * AutomationTrigger - Tetikleme tipi
 */
var ShipmentAutomationTrigger;
(function (ShipmentAutomationTrigger) {
    ShipmentAutomationTrigger["STATUS_CHANGE"] = "STATUS_CHANGE";
    ShipmentAutomationTrigger["SCHEDULED"] = "SCHEDULED";
    ShipmentAutomationTrigger["MANUAL"] = "MANUAL";
})(ShipmentAutomationTrigger || (exports.ShipmentAutomationTrigger = ShipmentAutomationTrigger = {}));
/**
 * ScheduleFrequency - Zamanlama sıklığı
 */
var ShipmentScheduleFrequency;
(function (ShipmentScheduleFrequency) {
    ShipmentScheduleFrequency["MINUTE"] = "minute";
    ShipmentScheduleFrequency["HOURLY"] = "hourly";
    ShipmentScheduleFrequency["DAILY"] = "daily";
    ShipmentScheduleFrequency["WEEKLY"] = "weekly";
})(ShipmentScheduleFrequency || (exports.ShipmentScheduleFrequency = ShipmentScheduleFrequency = {}));
//# sourceMappingURL=user-integration-settings-event.js.map