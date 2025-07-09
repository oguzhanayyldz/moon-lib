import { Request, Response, NextFunction } from 'express';
import { UserPayload, hasPermission } from './current-user';

/**
 * Basit ve Merkezi Permission Middleware Sistemi
 * Generic factory function ile tüm permission kontrolü
 */

/**
 * Generic permission middleware factory - Ana fonksiyon
 * Tüm permission kontrolleri bu tek function ile yapılır
 */
export const requirePermission = (resource: string, action: string, options?: {
    errorMessage?: string;
    logAccess?: boolean;
}) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const { errorMessage, logAccess = true } = options || {};
        
        // CurrentUser middleware'den user bilgilerini al
        const currentUser = req.currentUser as UserPayload;
        
        if (!currentUser) {
            return res.status(401).json({
                errors: [{ message: 'Authentication required' }]
            });
        }

        // Permission kontrolü yap
        const hasAccess = hasPermission(currentUser, resource, action);
        
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

/**
 * Basic Resource Tanımları - Client ile uyumlu
 * 6 temel resource, granular alt kaynaklar kaldırıldı
 */
export const RESOURCES = {
    PRODUCTS: 'products',       // products, brands, categories, attributes, combinations, packages, related products
    ORDERS: 'orders',           // orders, order items, shipping, returns
    INVENTORY: 'inventory',     // stock, warehouse operations, stock movements
    PRICING: 'pricing',         // pricing rules, discounts, promotions
    INTEGRATIONS: 'integrations', // marketplace connections, API integrations
    CATALOGS: 'catalogs',       // catalog mappings, product mappings
    SUBUSERS: 'subusers',       // sub user management (sadece admin/user)
    ANALYTICS: 'analytics',     // reports, analytics, dashboards
    SETTINGS: 'settings'        // system settings, user preferences
} as const;

/**
 * Basic Action Tanımları
 */
export const ACTIONS = {
    READ: 'read',
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    MANAGE: '*'
} as const;

// ============================
// BASIT SHORTHAND HELPER'LAR
// Yaygın kullanım için kısayol middleware'ler
// ============================

// Basic Resource Middleware'leri - Ana kullanım
export const requireProducts = requirePermission(RESOURCES.PRODUCTS, ACTIONS.MANAGE);
export const requireOrders = requirePermission(RESOURCES.ORDERS, ACTIONS.MANAGE);
export const requireInventory = requirePermission(RESOURCES.INVENTORY, ACTIONS.MANAGE);
export const requirePricing = requirePermission(RESOURCES.PRICING, ACTIONS.MANAGE);
export const requireIntegrations = requirePermission(RESOURCES.INTEGRATIONS, ACTIONS.MANAGE);
export const requireCatalogs = requirePermission(RESOURCES.CATALOGS, ACTIONS.MANAGE);
export const requireSubUsers = requirePermission(RESOURCES.SUBUSERS, ACTIONS.MANAGE);
export const requireAnalytics = requirePermission(RESOURCES.ANALYTICS, ACTIONS.READ);
export const requireSettings = requirePermission(RESOURCES.SETTINGS, ACTIONS.MANAGE);

// Backward compatibility - Eski kod için geçici
// TODO: Bu middleware'ler deprecated edilecek, requirePermission kullan
export const requireProductsRead = requirePermission(RESOURCES.PRODUCTS, ACTIONS.READ);
export const requireProductsCreate = requirePermission(RESOURCES.PRODUCTS, ACTIONS.CREATE);
export const requireProductsUpdate = requirePermission(RESOURCES.PRODUCTS, ACTIONS.UPDATE);
export const requireProductsDelete = requirePermission(RESOURCES.PRODUCTS, ACTIONS.DELETE);

export const requireOrdersRead = requirePermission(RESOURCES.ORDERS, ACTIONS.READ);
export const requireOrdersCreate = requirePermission(RESOURCES.ORDERS, ACTIONS.CREATE);
export const requireOrdersUpdate = requirePermission(RESOURCES.ORDERS, ACTIONS.UPDATE);
export const requireOrdersDelete = requirePermission(RESOURCES.ORDERS, ACTIONS.DELETE);

export const requireInventoryRead = requirePermission(RESOURCES.INVENTORY, ACTIONS.READ);
export const requireInventoryCreate = requirePermission(RESOURCES.INVENTORY, ACTIONS.CREATE);
export const requireInventoryUpdate = requirePermission(RESOURCES.INVENTORY, ACTIONS.UPDATE);
export const requireInventoryDelete = requirePermission(RESOURCES.INVENTORY, ACTIONS.DELETE);

// Deprecated granular middleware'ler - Artık products altında
// @deprecated Use requirePermission('products', action) instead
export const requireBrandsRead = requirePermission(RESOURCES.PRODUCTS, ACTIONS.READ);
export const requireBrandsCreate = requirePermission(RESOURCES.PRODUCTS, ACTIONS.CREATE);
export const requireBrandsUpdate = requirePermission(RESOURCES.PRODUCTS, ACTIONS.UPDATE);
export const requireBrandsDelete = requirePermission(RESOURCES.PRODUCTS, ACTIONS.DELETE);

export const requireCategoriesRead = requirePermission(RESOURCES.PRODUCTS, ACTIONS.READ);
export const requireCategoriesCreate = requirePermission(RESOURCES.PRODUCTS, ACTIONS.CREATE);
export const requireCategoriesUpdate = requirePermission(RESOURCES.PRODUCTS, ACTIONS.UPDATE);
export const requireCategoriesDelete = requirePermission(RESOURCES.PRODUCTS, ACTIONS.DELETE);

export const requireAttributesRead = requirePermission(RESOURCES.PRODUCTS, ACTIONS.READ);
export const requireAttributesCreate = requirePermission(RESOURCES.PRODUCTS, ACTIONS.CREATE);
export const requireAttributesUpdate = requirePermission(RESOURCES.PRODUCTS, ACTIONS.UPDATE);
export const requireAttributesDelete = requirePermission(RESOURCES.PRODUCTS, ACTIONS.DELETE);

export const requireAttributeValuesRead = requirePermission(RESOURCES.PRODUCTS, ACTIONS.READ);
export const requireAttributeValuesCreate = requirePermission(RESOURCES.PRODUCTS, ACTIONS.CREATE);
export const requireAttributeValuesUpdate = requirePermission(RESOURCES.PRODUCTS, ACTIONS.UPDATE);
export const requireAttributeValuesDelete = requirePermission(RESOURCES.PRODUCTS, ACTIONS.DELETE);

export const requireCombinationsRead = requirePermission(RESOURCES.PRODUCTS, ACTIONS.READ);
export const requireCombinationsCreate = requirePermission(RESOURCES.PRODUCTS, ACTIONS.CREATE);
export const requireCombinationsUpdate = requirePermission(RESOURCES.PRODUCTS, ACTIONS.UPDATE);
export const requireCombinationsDelete = requirePermission(RESOURCES.PRODUCTS, ACTIONS.DELETE);

export const requirePackagesRead = requirePermission(RESOURCES.PRODUCTS, ACTIONS.READ);
export const requirePackagesCreate = requirePermission(RESOURCES.PRODUCTS, ACTIONS.CREATE);
export const requirePackagesUpdate = requirePermission(RESOURCES.PRODUCTS, ACTIONS.UPDATE);
export const requirePackagesDelete = requirePermission(RESOURCES.PRODUCTS, ACTIONS.DELETE);

export const requireRelatedProductsRead = requirePermission(RESOURCES.PRODUCTS, ACTIONS.READ);
export const requireRelatedProductsCreate = requirePermission(RESOURCES.PRODUCTS, ACTIONS.CREATE);
export const requireRelatedProductsUpdate = requirePermission(RESOURCES.PRODUCTS, ACTIONS.UPDATE);
export const requireRelatedProductsDelete = requirePermission(RESOURCES.PRODUCTS, ACTIONS.DELETE);

export const requirePricingRead = requirePermission(RESOURCES.PRICING, ACTIONS.READ);
export const requirePricingCreate = requirePermission(RESOURCES.PRICING, ACTIONS.CREATE);
export const requirePricingUpdate = requirePermission(RESOURCES.PRICING, ACTIONS.UPDATE);
export const requirePricingDelete = requirePermission(RESOURCES.PRICING, ACTIONS.DELETE);

export const requireIntegrationsRead = requirePermission(RESOURCES.INTEGRATIONS, ACTIONS.READ);
export const requireIntegrationsCreate = requirePermission(RESOURCES.INTEGRATIONS, ACTIONS.CREATE);
export const requireIntegrationsUpdate = requirePermission(RESOURCES.INTEGRATIONS, ACTIONS.UPDATE);
export const requireIntegrationsDelete = requirePermission(RESOURCES.INTEGRATIONS, ACTIONS.DELETE);

export const requireCatalogsRead = requirePermission(RESOURCES.CATALOGS, ACTIONS.READ);
export const requireCatalogsCreate = requirePermission(RESOURCES.CATALOGS, ACTIONS.CREATE);
export const requireCatalogsUpdate = requirePermission(RESOURCES.CATALOGS, ACTIONS.UPDATE);
export const requireCatalogsDelete = requirePermission(RESOURCES.CATALOGS, ACTIONS.DELETE);

export const requireSubUsersRead = requirePermission(RESOURCES.SUBUSERS, ACTIONS.READ);
export const requireSubUsersCreate = requirePermission(RESOURCES.SUBUSERS, ACTIONS.CREATE);
export const requireSubUsersUpdate = requirePermission(RESOURCES.SUBUSERS, ACTIONS.UPDATE);
export const requireSubUsersDelete = requirePermission(RESOURCES.SUBUSERS, ACTIONS.DELETE);

export const requireAnalyticsRead = requirePermission(RESOURCES.ANALYTICS, ACTIONS.READ);

export const requireSettingsRead = requirePermission(RESOURCES.SETTINGS, ACTIONS.READ);
export const requireSettingsUpdate = requirePermission(RESOURCES.SETTINGS, ACTIONS.UPDATE);