"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuthAdmin = void 0;
const not_authorized_error_1 = require("../errors/not-authorized-error");
const user_role_1 = require("../types/user-role");
const current_user_1 = require("./current-user");
const requireAuthAdmin = (req, res, next) => {
    if (!req.currentUser) {
        throw new not_authorized_error_1.NotAuthorizedError();
    }
    if (req.currentUser.role != user_role_1.UserRole.Admin) {
        throw new not_authorized_error_1.NotAuthorizedError();
    }
    // ⚠️ `role` TEK BASINA ADMIN KANITI DEGIL: alt kullanici JWT'sinde `role`
    // HESAP SAHIBININ rolu (`buildLoginJwtPayload`, auth). Admin hesabinin alt
    // kullanicisi `{ role: 0, isSubUserMode: true }` tasir ve yukaridaki kontrolu
    // gecer; izinleri ne olursa olsun platform geneli admin rotalarina erisirdi.
    // Admin taklidi etkilenmez: taklit JWT'sinde `role` taklit edilen hesabin
    // gercek rolu, `isSubUserMode` hic yazilmaz (`impersonateUser.ts`).
    if ((0, current_user_1.isSubUser)(req.currentUser)) {
        throw new not_authorized_error_1.NotAuthorizedError();
    }
    next();
};
exports.requireAuthAdmin = requireAuthAdmin;
//# sourceMappingURL=require-auth-admin.js.map