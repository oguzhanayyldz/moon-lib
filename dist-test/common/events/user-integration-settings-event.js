"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceScheduleFrequency = exports.InvoiceAutomationTrigger = exports.ShipmentScheduleFrequency = exports.ShipmentAutomationTrigger = void 0;
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
// =====================================
// Invoice Settings Types
// =====================================
/**
 * InvoiceAutomationTrigger - Fatura otomasyon tetikleme tipi
 */
var InvoiceAutomationTrigger;
(function (InvoiceAutomationTrigger) {
    InvoiceAutomationTrigger["STATUS_CHANGE"] = "STATUS_CHANGE";
    InvoiceAutomationTrigger["SCHEDULED"] = "SCHEDULED";
    InvoiceAutomationTrigger["MANUAL"] = "MANUAL";
    InvoiceAutomationTrigger["INVOICE_FORMALIZATION"] = "INVOICE_FORMALIZATION";
})(InvoiceAutomationTrigger || (exports.InvoiceAutomationTrigger = InvoiceAutomationTrigger = {}));
/**
 * InvoiceScheduleFrequency - Fatura zamanlama sıklığı
 */
var InvoiceScheduleFrequency;
(function (InvoiceScheduleFrequency) {
    InvoiceScheduleFrequency["MINUTE"] = "minute";
    InvoiceScheduleFrequency["HOURLY"] = "hourly";
    InvoiceScheduleFrequency["DAILY"] = "daily";
    InvoiceScheduleFrequency["WEEKLY"] = "weekly";
})(InvoiceScheduleFrequency || (exports.InvoiceScheduleFrequency = InvoiceScheduleFrequency = {}));
//# sourceMappingURL=user-integration-settings-event.js.map