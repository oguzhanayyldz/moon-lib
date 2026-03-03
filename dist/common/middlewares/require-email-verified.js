"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireEmailVerified = void 0;
const not_authorized_error_1 = require("../errors/not-authorized-error");
const requireEmailVerified = (req, res, next) => {
    if (!req.currentUser) {
        throw new not_authorized_error_1.NotAuthorizedError();
    }
    // Strict false check: undefined/null geçer (eski kullanıcılar etkilenmez)
    if (req.currentUser.emailVerified === false) {
        throw new not_authorized_error_1.NotAuthorizedError('EMAIL_NOT_VERIFIED');
    }
    next();
};
exports.requireEmailVerified = requireEmailVerified;
