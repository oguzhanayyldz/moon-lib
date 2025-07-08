"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSION_RESOURCES = exports.PERMISSION_ACTIONS = void 0;
// Common permission constants
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
    CATALOGS: 'catalogs',
    INTEGRATIONS: 'integrations',
    STOCK: 'stock',
    PRICING: 'pricing',
    SUBUSERS: 'subusers', // Added for SubUser management
    ALL: '*'
};
