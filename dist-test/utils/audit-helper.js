"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logSubUserError = exports.logSubUserAction = exports.createErrorAuditLogEntry = exports.createAuditLogEntry = void 0;
const user_role_1 = require("../common/types/user-role");
/**
 * SubUser context için audit log entry oluşturur
 */
const createAuditLogEntry = (req, serviceName, operation, resourceType, resourceId, metadata) => {
    const currentUser = req.currentUser;
    return {
        service: serviceName,
        operation,
        resourceType,
        resourceId,
        actualUserId: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.subUserId) || (currentUser === null || currentUser === void 0 ? void 0 : currentUser.id) || 'unknown',
        effectiveUserId: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.id) || 'unknown',
        isSubUser: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.isSubUserMode) || false,
        userRole: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.role) || user_role_1.UserRole.SubUser,
        parentUserId: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.isSubUserMode) ? currentUser === null || currentUser === void 0 ? void 0 : currentUser.id : undefined,
        success: true,
        metadata,
        timestamp: new Date(),
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.get('User-Agent')
    };
};
exports.createAuditLogEntry = createAuditLogEntry;
/**
 * Hata durumu için audit log entry oluşturur
 */
const createErrorAuditLogEntry = (req, serviceName, operation, resourceType, error, resourceId, metadata) => {
    const entry = (0, exports.createAuditLogEntry)(req, serviceName, operation, resourceType, resourceId, metadata);
    return Object.assign(Object.assign({}, entry), { success: false, error: error.message });
};
exports.createErrorAuditLogEntry = createErrorAuditLogEntry;
/**
 * Audit log helper fonksiyonları
 */
const logSubUserAction = (req, serviceName, operation, resourceType, resourceId, metadata) => {
    const entry = (0, exports.createAuditLogEntry)(req, serviceName, operation, resourceType, resourceId, metadata);
    // Console'a yazdır (production'da database'e kaydedilebilir)
    console.log('[AUDIT LOG]', JSON.stringify(entry, null, 2));
};
exports.logSubUserAction = logSubUserAction;
/**
 * Hata durumunda audit log kaydı
 */
const logSubUserError = (req, serviceName, operation, resourceType, error, resourceId, metadata) => {
    const entry = (0, exports.createErrorAuditLogEntry)(req, serviceName, operation, resourceType, error, resourceId, metadata);
    // Console'a yazdır (production'da database'e kaydedilebilir)
    console.log('[AUDIT LOG]', JSON.stringify(entry, null, 2));
};
exports.logSubUserError = logSubUserError;
//# sourceMappingURL=audit-helper.js.map