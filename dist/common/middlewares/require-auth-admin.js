"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuthAdmin = void 0;
const not_authorized_error_1 = require("../errors/not-authorized-error");
const user_role_1 = require("../types/user-role");
const requireAuthAdmin = (req, res, next) => {
    if (!req.currentUser) {
        throw new not_authorized_error_1.NotAuthorizedError();
    }
    if (req.currentUser.role != user_role_1.UserRole.Admin) {
        throw new not_authorized_error_1.NotAuthorizedError();
    }
    next();
};
exports.requireAuthAdmin = requireAuthAdmin;
