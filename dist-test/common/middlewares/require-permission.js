"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRelatedProductsCreate = exports.requireRelatedProductsRead = exports.requirePackagesDelete = exports.requirePackagesUpdate = exports.requirePackagesCreate = exports.requirePackagesRead = exports.requireCombinationsDelete = exports.requireCombinationsUpdate = exports.requireCombinationsCreate = exports.requireCombinationsRead = exports.requireAttributeValuesDelete = exports.requireAttributeValuesUpdate = exports.requireAttributeValuesCreate = exports.requireAttributeValuesRead = exports.requireAttributesDelete = exports.requireAttributesUpdate = exports.requireAttributesCreate = exports.requireAttributesRead = exports.requireCategoriesDelete = exports.requireCategoriesUpdate = exports.requireCategoriesCreate = exports.requireCategoriesRead = exports.requireBrandsDelete = exports.requireBrandsUpdate = exports.requireBrandsCreate = exports.requireBrandsRead = exports.requireInventoryDelete = exports.requireInventoryUpdate = exports.requireInventoryCreate = exports.requireInventoryRead = exports.requireOrdersDelete = exports.requireOrdersUpdate = exports.requireOrdersCreate = exports.requireOrdersRead = exports.requireProductsDelete = exports.requireProductsUpdate = exports.requireProductsCreate = exports.requireProductsRead = exports.requireSettings = exports.requireAnalytics = exports.requireSubUsers = exports.requireCatalogs = exports.requireIntegrations = exports.requirePricing = exports.requireInventory = exports.requireOrders = exports.requireProducts = exports.ACTIONS = exports.RESOURCES = exports.requirePermission = void 0;
exports.requireSettingsUpdate = exports.requireSettingsRead = exports.requireAnalyticsRead = exports.requireSubUsersDelete = exports.requireSubUsersUpdate = exports.requireSubUsersCreate = exports.requireSubUsersRead = exports.requireCatalogsDelete = exports.requireCatalogsUpdate = exports.requireCatalogsCreate = exports.requireCatalogsRead = exports.requireIntegrationsDelete = exports.requireIntegrationsUpdate = exports.requireIntegrationsCreate = exports.requireIntegrationsRead = exports.requirePricingDelete = exports.requirePricingUpdate = exports.requirePricingCreate = exports.requirePricingRead = exports.requireRelatedProductsDelete = exports.requireRelatedProductsUpdate = void 0;
const current_user_1 = require("./current-user");
/**
 * Basit ve Merkezi Permission Middleware Sistemi
 * Generic factory function ile tüm permission kontrolü
 */
/**
 * Generic permission middleware factory - Ana fonksiyon
 * Tüm permission kontrolleri bu tek function ile yapılır
 */
const requirePermission = (resource, action, options) => {
    return (req, res, next) => {
        const { errorMessage, logAccess = true } = options || {};
        // CurrentUser middleware'den user bilgilerini al
        const currentUser = req.currentUser;
        if (!currentUser) {
            return res.status(401).json({
                errors: [{ message: 'Authentication required' }]
            });
        }
        // Permission kontrolü yap
        const hasAccess = (0, current_user_1.hasPermission)(currentUser, resource, action);
        if (!hasAccess) {
            // Audit log için
            if (logAccess) {
                console.warn(`Permission denied: User ${currentUser.id} (role: ${currentUser.role}) attempted ${action} on ${resource}`);
            }
            return res.status(403).json({
                errors: [{
                        message: errorMessage || `Insufficient permissions for ${action} on ${resource}`,
                        field: 'permissions'
                    }]
            });
        }
        // Success log (opsiyonel)
        if (logAccess) {
            console.log(`Permission granted: User ${currentUser.id} performing ${action} on ${resource}`);
        }
        next();
    };
};
exports.requirePermission = requirePermission;
/**
 * Basic Resource Tanımları - Client ile uyumlu
 * 6 temel resource, granular alt kaynaklar kaldırıldı
 */
exports.RESOURCES = {
    PRODUCTS: 'products', // products, brands, categories, attributes, combinations, packages, related products
    ORDERS: 'orders', // orders, order items, shipping, returns
    INVENTORY: 'inventory', // stock, warehouse operations, stock movements
    PRICING: 'pricing', // pricing rules, discounts, promotions
    INTEGRATIONS: 'integrations', // marketplace connections, API integrations
    CATALOGS: 'catalogs', // catalog mappings, product mappings
    SUBUSERS: 'subusers', // sub user management (sadece admin/user)
    ANALYTICS: 'analytics', // reports, analytics, dashboards
    SETTINGS: 'settings' // system settings, user preferences
};
/**
 * Basic Action Tanımları
 */
exports.ACTIONS = {
    READ: 'read',
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    MANAGE: '*'
};
// ============================
// BASIT SHORTHAND HELPER'LAR
// Yaygın kullanım için kısayol middleware'ler
// ============================
// Basic Resource Middleware'leri - Ana kullanım
exports.requireProducts = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.MANAGE);
exports.requireOrders = (0, exports.requirePermission)(exports.RESOURCES.ORDERS, exports.ACTIONS.MANAGE);
exports.requireInventory = (0, exports.requirePermission)(exports.RESOURCES.INVENTORY, exports.ACTIONS.MANAGE);
exports.requirePricing = (0, exports.requirePermission)(exports.RESOURCES.PRICING, exports.ACTIONS.MANAGE);
exports.requireIntegrations = (0, exports.requirePermission)(exports.RESOURCES.INTEGRATIONS, exports.ACTIONS.MANAGE);
exports.requireCatalogs = (0, exports.requirePermission)(exports.RESOURCES.CATALOGS, exports.ACTIONS.MANAGE);
exports.requireSubUsers = (0, exports.requirePermission)(exports.RESOURCES.SUBUSERS, exports.ACTIONS.MANAGE);
exports.requireAnalytics = (0, exports.requirePermission)(exports.RESOURCES.ANALYTICS, exports.ACTIONS.READ);
exports.requireSettings = (0, exports.requirePermission)(exports.RESOURCES.SETTINGS, exports.ACTIONS.MANAGE);
// Backward compatibility - Eski kod için geçici
// TODO: Bu middleware'ler deprecated edilecek, requirePermission kullan
exports.requireProductsRead = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.READ);
exports.requireProductsCreate = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.CREATE);
exports.requireProductsUpdate = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.UPDATE);
exports.requireProductsDelete = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.DELETE);
exports.requireOrdersRead = (0, exports.requirePermission)(exports.RESOURCES.ORDERS, exports.ACTIONS.READ);
exports.requireOrdersCreate = (0, exports.requirePermission)(exports.RESOURCES.ORDERS, exports.ACTIONS.CREATE);
exports.requireOrdersUpdate = (0, exports.requirePermission)(exports.RESOURCES.ORDERS, exports.ACTIONS.UPDATE);
exports.requireOrdersDelete = (0, exports.requirePermission)(exports.RESOURCES.ORDERS, exports.ACTIONS.DELETE);
exports.requireInventoryRead = (0, exports.requirePermission)(exports.RESOURCES.INVENTORY, exports.ACTIONS.READ);
exports.requireInventoryCreate = (0, exports.requirePermission)(exports.RESOURCES.INVENTORY, exports.ACTIONS.CREATE);
exports.requireInventoryUpdate = (0, exports.requirePermission)(exports.RESOURCES.INVENTORY, exports.ACTIONS.UPDATE);
exports.requireInventoryDelete = (0, exports.requirePermission)(exports.RESOURCES.INVENTORY, exports.ACTIONS.DELETE);
// Deprecated granular middleware'ler - Artık products altında
// @deprecated Use requirePermission('products', action) instead
exports.requireBrandsRead = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.READ);
exports.requireBrandsCreate = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.CREATE);
exports.requireBrandsUpdate = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.UPDATE);
exports.requireBrandsDelete = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.DELETE);
exports.requireCategoriesRead = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.READ);
exports.requireCategoriesCreate = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.CREATE);
exports.requireCategoriesUpdate = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.UPDATE);
exports.requireCategoriesDelete = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.DELETE);
exports.requireAttributesRead = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.READ);
exports.requireAttributesCreate = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.CREATE);
exports.requireAttributesUpdate = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.UPDATE);
exports.requireAttributesDelete = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.DELETE);
exports.requireAttributeValuesRead = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.READ);
exports.requireAttributeValuesCreate = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.CREATE);
exports.requireAttributeValuesUpdate = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.UPDATE);
exports.requireAttributeValuesDelete = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.DELETE);
exports.requireCombinationsRead = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.READ);
exports.requireCombinationsCreate = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.CREATE);
exports.requireCombinationsUpdate = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.UPDATE);
exports.requireCombinationsDelete = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.DELETE);
exports.requirePackagesRead = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.READ);
exports.requirePackagesCreate = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.CREATE);
exports.requirePackagesUpdate = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.UPDATE);
exports.requirePackagesDelete = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.DELETE);
exports.requireRelatedProductsRead = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.READ);
exports.requireRelatedProductsCreate = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.CREATE);
exports.requireRelatedProductsUpdate = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.UPDATE);
exports.requireRelatedProductsDelete = (0, exports.requirePermission)(exports.RESOURCES.PRODUCTS, exports.ACTIONS.DELETE);
exports.requirePricingRead = (0, exports.requirePermission)(exports.RESOURCES.PRICING, exports.ACTIONS.READ);
exports.requirePricingCreate = (0, exports.requirePermission)(exports.RESOURCES.PRICING, exports.ACTIONS.CREATE);
exports.requirePricingUpdate = (0, exports.requirePermission)(exports.RESOURCES.PRICING, exports.ACTIONS.UPDATE);
exports.requirePricingDelete = (0, exports.requirePermission)(exports.RESOURCES.PRICING, exports.ACTIONS.DELETE);
exports.requireIntegrationsRead = (0, exports.requirePermission)(exports.RESOURCES.INTEGRATIONS, exports.ACTIONS.READ);
exports.requireIntegrationsCreate = (0, exports.requirePermission)(exports.RESOURCES.INTEGRATIONS, exports.ACTIONS.CREATE);
exports.requireIntegrationsUpdate = (0, exports.requirePermission)(exports.RESOURCES.INTEGRATIONS, exports.ACTIONS.UPDATE);
exports.requireIntegrationsDelete = (0, exports.requirePermission)(exports.RESOURCES.INTEGRATIONS, exports.ACTIONS.DELETE);
exports.requireCatalogsRead = (0, exports.requirePermission)(exports.RESOURCES.CATALOGS, exports.ACTIONS.READ);
exports.requireCatalogsCreate = (0, exports.requirePermission)(exports.RESOURCES.CATALOGS, exports.ACTIONS.CREATE);
exports.requireCatalogsUpdate = (0, exports.requirePermission)(exports.RESOURCES.CATALOGS, exports.ACTIONS.UPDATE);
exports.requireCatalogsDelete = (0, exports.requirePermission)(exports.RESOURCES.CATALOGS, exports.ACTIONS.DELETE);
exports.requireSubUsersRead = (0, exports.requirePermission)(exports.RESOURCES.SUBUSERS, exports.ACTIONS.READ);
exports.requireSubUsersCreate = (0, exports.requirePermission)(exports.RESOURCES.SUBUSERS, exports.ACTIONS.CREATE);
exports.requireSubUsersUpdate = (0, exports.requirePermission)(exports.RESOURCES.SUBUSERS, exports.ACTIONS.UPDATE);
exports.requireSubUsersDelete = (0, exports.requirePermission)(exports.RESOURCES.SUBUSERS, exports.ACTIONS.DELETE);
exports.requireAnalyticsRead = (0, exports.requirePermission)(exports.RESOURCES.ANALYTICS, exports.ACTIONS.READ);
exports.requireSettingsRead = (0, exports.requirePermission)(exports.RESOURCES.SETTINGS, exports.ACTIONS.READ);
exports.requireSettingsUpdate = (0, exports.requirePermission)(exports.RESOURCES.SETTINGS, exports.ACTIONS.UPDATE);
//# sourceMappingURL=require-permission.js.map