/**
 * common-client.ts — Frontend-safe entry point
 *
 * Bu dosya sadece client (Next.js) tarafından kullanılacak
 * frontend-safe export'ları içerir. Backend-specific bağımlılıklar
 * (Mongoose, NATS, Redis vb.) bu entry point'ten hariç tutulmuştur.
 */

// ========== Types / Enums ==========
export * from './common/types/address-type';
export * from './common/types/attributes-type';
export * from './common/types/common.types';
export * from './common/types/credential-type';
export * from './common/types/credential-group';
export * from './common/types/currency-code';
export * from './common/types/currency-symbol';
export * from './common/types/entity.types';
export * from './common/types/fix-status';
export * from './common/types/integration-status';
export * from './common/types/integration-type';
export * from './common/types/integration-limits';
export * from './common/types/number-comparisons-type';
export * from './common/types/resourceName';
export * from './common/types/sort-type';
export * from './common/types/stock-action-type';
export * from './common/types/unit-type';
export * from './common/types/user-role';
export * from './common/types/permission.types';
export * from './common/types/integration-params';
export * from './common/types/cron-defaults';

// ========== Event Types (pure enums, no backend deps) ==========
export * from './common/events/types/order-status';
export * from './common/events/types/order-status2';
export * from './common/events/types/order-type';
export * from './common/events/types/product-type';
export * from './common/events/types/product-status';
export * from './common/events/types/payment-type';
export * from './common/events/types/return-status';
export * from './common/events/types/invoice-status';

// ========== Event Subjects (WebSocket/real-time için) ==========
export { Subjects } from './common/events/subjects';

// ========== Constants ==========
export * from './common/constants/cargo-label-support.constants';
export * from './common/constants/integration-commands';

// ========== Interfaces (frontend-safe olanlar) ==========
export * from './common/interfaces/validator-func-params.interface';
export * from './common/interfaces/integration-instance.interface';
export * from './common/interfaces/product-integration-created.interface';
export * from './common/interfaces/product-price-integration-updated.interface';
export * from './common/interfaces/product-stock-integration-updated.interface';
export * from './common/interfaces/product-image-integration-updated.interface';
export * from './common/interfaces/product-export.interface';
export * from './common/interfaces/invoice-export.interface';
export * from './common/interfaces/shipment-export.interface';
export * from './common/interfaces/order-integration-created.interface';
export * from './common/interfaces/order-integration-status-updated.interface';
export * from './common/interfaces/api-client.interface';
export * from './common/interfaces/external-location.interface';
// NOT: entity-deletion.interface ve batch-deletion.interface
// Mongoose ClientSession bağımlılığı nedeniyle hariç tutulmuştur.
