"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.currentUser = exports.hasPermission = exports.isSubUser = exports.getActualUserId = exports.getEffectiveUserId = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_role_1 = require("../types/user-role");
// Helper functions for SubUser context
const getEffectiveUserId = (user) => {
    // For SubUsers, return parent user ID for data access
    // For regular users and admins, return their own ID
    return user.role === user_role_1.UserRole.SubUser && user.parentUser ? user.parentUser : user.id;
};
exports.getEffectiveUserId = getEffectiveUserId;
const getActualUserId = (user) => {
    // Always return the actual user ID for audit logging
    return user.id;
};
exports.getActualUserId = getActualUserId;
const isSubUser = (user) => {
    return user.role === user_role_1.UserRole.SubUser;
};
exports.isSubUser = isSubUser;
const hasPermission = (user, resource, action) => {
    // Convert role to number to ensure type safety
    const roleNumber = Number(user.role);
    // Admin and User roles have full access
    if (roleNumber === user_role_1.UserRole.Admin || roleNumber === user_role_1.UserRole.User) {
        // SubUser mode kontrolü - SubUser modunda ise permissions'a bak
        if (user.isSubUserMode && user.permissions) {
            const permission = user.permissions.find(p => p.resource === resource);
            return permission ? permission.actions.includes(action) || permission.actions.includes('*') : false;
        }
        return true;
    }
    // Direct SubUser login (should not happen with new flow)
    if (roleNumber === user_role_1.UserRole.SubUser && user.permissions) {
        const permission = user.permissions.find(p => p.resource === resource);
        return permission ? permission.actions.includes(action) || permission.actions.includes('*') : false;
    }
    return false;
};
exports.hasPermission = hasPermission;
const currentUser = (req, res, next) => {
    var _a;
    if (!((_a = req.session) === null || _a === void 0 ? void 0 : _a.jwt)) {
        return next();
    }
    try {
        const payload = jsonwebtoken_1.default.verify(req.session.jwt, process.env.JWT_KEY);
        req.currentUser = payload;
    }
    catch (err) { }
    next();
};
exports.currentUser = currentUser;
