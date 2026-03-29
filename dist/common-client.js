"use strict";
/**
 * common-client.ts — Frontend-safe entry point
 *
 * Bu dosya sadece client (Next.js) tarafından kullanılacak
 * frontend-safe export'ları içerir. Backend-specific bağımlılıklar
 * (Mongoose, NATS, Redis vb.) bu entry point'ten hariç tutulmuştur.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Subjects = void 0;
// ========== Types / Enums ==========
__exportStar(require("./common/types/address-type"), exports);
__exportStar(require("./common/types/attributes-type"), exports);
__exportStar(require("./common/types/common.types"), exports);
__exportStar(require("./common/types/credential-type"), exports);
__exportStar(require("./common/types/credential-group"), exports);
__exportStar(require("./common/types/currency-code"), exports);
__exportStar(require("./common/types/currency-symbol"), exports);
__exportStar(require("./common/types/entity.types"), exports);
__exportStar(require("./common/types/fix-status"), exports);
__exportStar(require("./common/types/integration-status"), exports);
__exportStar(require("./common/types/integration-type"), exports);
__exportStar(require("./common/types/integration-limits"), exports);
__exportStar(require("./common/types/number-comparisons-type"), exports);
__exportStar(require("./common/types/resourceName"), exports);
__exportStar(require("./common/types/sort-type"), exports);
__exportStar(require("./common/types/stock-action-type"), exports);
__exportStar(require("./common/types/unit-type"), exports);
__exportStar(require("./common/types/user-role"), exports);
__exportStar(require("./common/types/permission.types"), exports);
__exportStar(require("./common/types/integration-params"), exports);
__exportStar(require("./common/types/cron-defaults"), exports);
// ========== Event Types (pure enums, no backend deps) ==========
__exportStar(require("./common/events/types/order-status"), exports);
__exportStar(require("./common/events/types/order-status2"), exports);
__exportStar(require("./common/events/types/order-type"), exports);
__exportStar(require("./common/events/types/product-type"), exports);
__exportStar(require("./common/events/types/product-status"), exports);
__exportStar(require("./common/events/types/payment-type"), exports);
__exportStar(require("./common/events/types/return-status"), exports);
__exportStar(require("./common/events/types/invoice-status"), exports);
// ========== Event Subjects (WebSocket/real-time için) ==========
var subjects_1 = require("./common/events/subjects");
Object.defineProperty(exports, "Subjects", { enumerable: true, get: function () { return subjects_1.Subjects; } });
// ========== Constants ==========
__exportStar(require("./common/constants/cargo-label-support.constants"), exports);
__exportStar(require("./common/constants/integration-commands"), exports);
// ========== Interfaces (frontend-safe olanlar) ==========
__exportStar(require("./common/interfaces/validator-func-params.interface"), exports);
__exportStar(require("./common/interfaces/integration-instance.interface"), exports);
__exportStar(require("./common/interfaces/product-integration-created.interface"), exports);
__exportStar(require("./common/interfaces/product-price-integration-updated.interface"), exports);
__exportStar(require("./common/interfaces/product-stock-integration-updated.interface"), exports);
__exportStar(require("./common/interfaces/product-image-integration-updated.interface"), exports);
__exportStar(require("./common/interfaces/product-export.interface"), exports);
__exportStar(require("./common/interfaces/invoice-export.interface"), exports);
__exportStar(require("./common/interfaces/shipment-export.interface"), exports);
__exportStar(require("./common/interfaces/order-integration-created.interface"), exports);
__exportStar(require("./common/interfaces/order-integration-status-updated.interface"), exports);
__exportStar(require("./common/interfaces/api-client.interface"), exports);
__exportStar(require("./common/interfaces/external-location.interface"), exports);
// NOT: entity-deletion.interface ve batch-deletion.interface
// Mongoose ClientSession bağımlılığı nedeniyle hariç tutulmuştur.
