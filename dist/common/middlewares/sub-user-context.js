"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subUserContext = void 0;
const current_user_1 = require("./current-user");
/**
 * Merkezi SubUser Context Middleware
 * Tüm servislerde kullanılabilir, request'e context bilgilerini ekler
 */
const subUserContext = (req, res, next) => {
    // X-Effective-User-Id ve X-Actual-User-Id header'larını kontrol et
    const effectiveUserIdHeader = req.headers['x-effective-user-id'];
    const actualUserIdHeader = req.headers['x-actual-user-id'];
    // Eğer currentUser varsa, context bilgilerini ayıkla
    if (req.currentUser) {
        // Helper method'ları kullanarak context bilgilerini al
        const effectiveUserId = (0, current_user_1.getEffectiveUserId)(req.currentUser);
        const actualUserId = (0, current_user_1.getActualUserId)(req.currentUser);
        // Request'e context bilgilerini ekle
        req.effectiveUserId = effectiveUserId;
        req.actualUserId = actualUserId;
        req.isSubUser = (0, current_user_1.isSubUser)(req.currentUser);
        // Header'dan gelen bilgileri de kontrol et (admin impersonation için)
        if (effectiveUserIdHeader && actualUserIdHeader) {
            // Header'dan gelen bilgileri kullan (admin impersonation durumu)
            req.effectiveUserId = effectiveUserIdHeader;
            req.actualUserId = actualUserIdHeader;
        }
        // Audit logging için orijinal user bilgilerini sakla
        req.auditContext = {
            actualUserId: actualUserId,
            effectiveUserId: effectiveUserId,
            isSubUser: (0, current_user_1.isSubUser)(req.currentUser),
            userRole: req.currentUser.role,
            parentUserId: req.currentUser.parentUser
        };
    }
    next();
};
exports.subUserContext = subUserContext;
