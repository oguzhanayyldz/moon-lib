"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireOnboarding = void 0;
const not_authorized_error_1 = require("../errors/not-authorized-error");
const user_role_1 = require("../types/user-role");
const requireOnboarding = (req, res, next) => {
    if (!req.currentUser) {
        throw new not_authorized_error_1.NotAuthorizedError();
    }
    // Admin ve SubUser muaf
    const roleNumber = Number(req.currentUser.role);
    if (roleNumber === user_role_1.UserRole.Admin || roleNumber === user_role_1.UserRole.SubUser) {
        return next();
    }
    // SubUser mode'da muaf
    if (req.currentUser.isSubUserMode) {
        return next();
    }
    // Strict false check: undefined/null geçer (eski kullanıcılar etkilenmez)
    if (req.currentUser.onboardingCompleted === false) {
        throw new not_authorized_error_1.NotAuthorizedError('ONBOARDING_REQUIRED');
    }
    next();
};
exports.requireOnboarding = requireOnboarding;
//# sourceMappingURL=require-onboarding.js.map