"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePlatformName = exports.extractPlatformFromIntegrationId = exports.requirePlatformPermission = void 0;
const current_user_1 = require("./current-user");
/**
 * Platform-Aware Permission Middleware
 *
 * Integration ve Catalog resource'ları için platform bazlı yetkilendirme sağlar.
 * Permission constraints içinde platforms dizisi kontrol edilir.
 *
 * @example
 * // Integration trigger endpoint
 * requirePlatformPermission(
 *   'integrations',
 *   'update',
 *   (req) => req.params.integrationId
 * )
 *
 * // Catalog mapping endpoint
 * requirePlatformPermission(
 *   'catalogs',
 *   'create',
 *   (req) => req.body.integrationName
 * )
 */
const requirePlatformPermission = (resource, action, getPlatformId, options) => {
    return (req, res, next) => {
        var _a, _b;
        const { errorMessage, logAccess = true, allowNoConstraints = true } = options || {};
        // CurrentUser middleware'den user bilgilerini al
        const currentUser = req.currentUser;
        if (!currentUser) {
            return res.status(401).json({
                errors: [{ message: 'Authentication required' }]
            });
        }
        // Temel permission kontrolü yap
        const hasBasicPermission = (0, current_user_1.hasPermission)(currentUser, resource, action);
        if (!hasBasicPermission) {
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
        // Platform constraint kontrolü
        const platformId = getPlatformId(req);
        // Platform ID yoksa skip platform check (isteğe bağlı)
        if (!platformId) {
            if (logAccess) {
                console.log(`Permission granted (no platform check): User ${currentUser.id} performing ${action} on ${resource}`);
            }
            return next();
        }
        // User'ın bu resource için permission'ını bul
        const userPermission = (_a = currentUser.permissions) === null || _a === void 0 ? void 0 : _a.find((p) => p.resource === resource && p.actions.includes(action));
        // Platform constraint kontrolü
        if ((_b = userPermission === null || userPermission === void 0 ? void 0 : userPermission.constraints) === null || _b === void 0 ? void 0 : _b.platforms) {
            const allowedPlatforms = userPermission.constraints.platforms;
            if (!allowedPlatforms.includes(platformId)) {
                if (logAccess) {
                    console.warn(`Platform permission denied: User ${currentUser.id} attempted ${action} ` +
                        `on ${resource} for platform ${platformId}. ` +
                        `Allowed platforms: ${allowedPlatforms.join(', ')}`);
                }
                return res.status(403).json({
                    errors: [{
                            message: errorMessage || `Not authorized for ${action} on ${resource} for this platform`,
                            field: 'permissions',
                            platform: platformId,
                            allowedPlatforms
                        }]
                });
            }
        }
        else if (!allowNoConstraints) {
            // Eğer constraint yoksa ve allowNoConstraints=false ise reddet
            if (logAccess) {
                console.warn(`Platform constraint required: User ${currentUser.id} attempted ${action} ` +
                    `on ${resource} without platform constraints`);
            }
            return res.status(403).json({
                errors: [{
                        message: errorMessage || `Platform constraints required for ${action} on ${resource}`,
                        field: 'permissions'
                    }]
            });
        }
        // Success log
        if (logAccess) {
            console.log(`Platform permission granted: User ${currentUser.id} performing ${action} ` +
                `on ${resource} for platform ${platformId || 'all'}`);
        }
        next();
    };
};
exports.requirePlatformPermission = requirePlatformPermission;
/**
 * Integration ID'den platform ismini çıkartan helper function
 * Integration document'inde platform adı saklanıyorsa kullanılabilir
 */
const extractPlatformFromIntegrationId = async (integrationId, IntegrationModel) => {
    try {
        const integration = await IntegrationModel.findById(integrationId);
        return (integration === null || integration === void 0 ? void 0 : integration.name) || (integration === null || integration === void 0 ? void 0 : integration.type);
    }
    catch (error) {
        console.error('Error fetching integration:', error);
        return undefined;
    }
};
exports.extractPlatformFromIntegrationId = extractPlatformFromIntegrationId;
/**
 * Integration name'den platform ismini normalize eden helper
 * Örnek: 'trendyol_marketplace' -> 'trendyol'
 */
const normalizePlatformName = (platformName) => {
    return platformName.toLowerCase().split('_')[0].split('-')[0];
};
exports.normalizePlatformName = normalizePlatformName;
//# sourceMappingURL=require-platform-permission.js.map