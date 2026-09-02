"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subUserContext = void 0;
const current_user_1 = require("./current-user");
/**
 * Merkezi SubUser Context Middleware
 * Tüm servislerde kullanılabilir, request'e context bilgilerini ekler
 *
 * ⚠️ `X-Effective-User-Id`/`X-Actual-User-Id` header'ları BİLEREK okunmaz
 * (issue #653 — çapraz-tenant IDOR). Bu değerler istemciden gelen, imzasız
 * girdi; sunucu tarafı yetki sınırı olarak kullanılamaz. effectiveUserId/
 * actualUserId SADECE `req.currentUser`'daki imzalı JWT'den hesaplanır.
 */
const subUserContext = (req, res, next) => {
    // Eğer currentUser varsa, context bilgilerini ayıkla
    if (req.currentUser) {
        // Helper method'ları kullanarak context bilgilerini al
        const effectiveUserId = (0, current_user_1.getEffectiveUserId)(req.currentUser);
        const actualUserId = (0, current_user_1.getActualUserId)(req.currentUser);
        // Request'e context bilgilerini ekle
        req.effectiveUserId = effectiveUserId;
        req.actualUserId = actualUserId;
        req.isSubUser = (0, current_user_1.isSubUser)(req.currentUser);
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
//# sourceMappingURL=sub-user-context.js.map