"use strict";
// Permission interface and constants for SubUser role management
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSION_RESOURCES = exports.PERMISSION_ACTIONS = void 0;
exports.PERMISSION_ACTIONS = {
    READ: 'read',
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    ALL: '*'
};
exports.PERMISSION_RESOURCES = {
    PRODUCTS: 'products',
    ORDERS: 'orders',
    INVENTORY: 'inventory',
    PRICING: 'pricing',
    INTEGRATIONS: 'integrations',
    CATALOGS: 'catalogs',
    ALL: '*'
};
//# sourceMappingURL=permission.types.js.map