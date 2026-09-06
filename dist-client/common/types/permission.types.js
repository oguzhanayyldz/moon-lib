"use strict";
// Permission interface and constants for SubUser role management
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSION_RESOURCES = exports.PERMISSION_ACTIONS = void 0;
exports.PERMISSION_ACTIONS = {
    READ: 'read',
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    TRIGGER: 'trigger',
    ALL: '*'
};
exports.PERMISSION_RESOURCES = {
    PRODUCTS: 'products',
    ORDERS: 'orders',
    CATEGORIES: 'categories',
    BRANDS: 'brands',
    WAREHOUSES: 'warehouses',
    SHELVES: 'shelves',
    INVENTORY: 'inventory',
    PRICING: 'pricing',
    INTEGRATIONS: 'integrations',
    CATALOGS: 'catalogs',
    FULFILLMENT: 'fulfillment',
    ANALYTICS: 'analytics',
    // Alis faturasi + tedarikci (issue #638) — INVENTORY'den AYRI tutuldu:
    // alis fiyati ticari veridir, alt kullaniciya stok gorme yetkisi verip
    // alis fiyatini gizlemek mesru bir ihtiyactir.
    PURCHASES: 'purchases',
    ALL: '*'
};
