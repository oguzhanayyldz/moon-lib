"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.currentUser = exports.hasPlatformPermission = exports.hasPermission = exports.isSubUser = exports.getActualUserId = exports.getEffectiveUserId = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_role_1 = require("../types/user-role");
const redisWrapper_service_1 = require("../../services/redisWrapper.service");
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
/**
 * Platform-aware permission check
 * Integration ve Catalog gibi platform-specific resource'lar için kullanılır
 *
 * @param user - Current user payload
 * @param resource - Resource name (integrations, catalogs, etc.)
 * @param action - Action to perform (read, create, update, delete, trigger)
 * @param platformName - Platform name to check (trendyol, shopify, etc.)
 * @returns true if user has permission for this platform
 */
const hasPlatformPermission = (user, resource, action, platformName) => {
    var _a, _b;
    // First check basic permission
    if (!(0, exports.hasPermission)(user, resource, action)) {
        return false;
    }
    // If no platform check needed, return true
    if (!platformName) {
        return true;
    }
    // Convert role to number
    const roleNumber = Number(user.role);
    // Admin and User roles - check if SubUser mode
    if (roleNumber === user_role_1.UserRole.Admin || roleNumber === user_role_1.UserRole.User) {
        if (user.isSubUserMode && user.permissions) {
            const permission = user.permissions.find(p => p.resource === resource && (p.actions.includes(action) || p.actions.includes('*')));
            // Check platform constraints
            if ((_a = permission === null || permission === void 0 ? void 0 : permission.constraints) === null || _a === void 0 ? void 0 : _a.platforms) {
                return permission.constraints.platforms.includes(platformName);
            }
            // No platform constraint means all platforms allowed
            return true;
        }
        // Not SubUser mode means full access
        return true;
    }
    // Direct SubUser login
    if (roleNumber === user_role_1.UserRole.SubUser && user.permissions) {
        const permission = user.permissions.find(p => p.resource === resource && (p.actions.includes(action) || p.actions.includes('*')));
        // Check platform constraints
        if ((_b = permission === null || permission === void 0 ? void 0 : permission.constraints) === null || _b === void 0 ? void 0 : _b.platforms) {
            return permission.constraints.platforms.includes(platformName);
        }
        // No platform constraint means all platforms allowed
        return true;
    }
    return false;
};
exports.hasPlatformPermission = hasPlatformPermission;
const currentUser = (req, res, next) => {
    var _a;
    if (!((_a = req.session) === null || _a === void 0 ? void 0 : _a.jwt)) {
        return next();
    }
    try {
        const payload = jsonwebtoken_1.default.verify(req.session.jwt, process.env.JWT_KEY);
        // Session validation - if sessionId exists in JWT and Redis is available (make it non-blocking)
        if (payload.sessionId) {
            // Check if Redis is available before attempting session validation
            try {
                if (redisWrapper_service_1.redisWrapper && redisWrapper_service_1.redisWrapper.client) {
                    // For SubUser mode, use subUserId for session tracking, otherwise use payload.id
                    const sessionUserId = payload.isSubUserMode && payload.subUserId ? payload.subUserId : payload.id;
                    // Non-blocking session check - don't await
                    redisWrapper_service_1.redisWrapper.client.hGet(`user_sessions:${sessionUserId}`, payload.sessionId)
                        .then(isSessionValid => {
                        if (!isSessionValid) {
                            // Session not found in Redis - but don't immediately clear JWT
                            // This could be a temporary Redis issue or TTL expiry
                            // console.warn('[CurrentUser] Session not found in Redis, but keeping JWT for now:', {
                            //     sessionUserId,
                            //     sessionId: payload.sessionId,
                            //     userEmail: payload.email,
                            //     isSubUserMode: payload.isSubUserMode
                            // });
                            // Note: NOT clearing JWT here - let currentUser endpoint handle this
                        }
                        else {
                            // Update session activity (non-blocking)
                            try {
                                const sessionData = JSON.parse(isSessionValid);
                                sessionData.lastActivity = new Date();
                                redisWrapper_service_1.redisWrapper.client.hSet(`user_sessions:${sessionUserId}`, payload.sessionId, JSON.stringify(sessionData))
                                    .catch(updateErr => {
                                    // console.warn('[CurrentUser] Failed to update session activity:', updateErr.message);
                                });
                            }
                            catch (_a) {
                                // If update fails, continue anyway
                            }
                        }
                    })
                        .catch(err => {
                        // Redis error - continue without session validation, don't clear JWT
                        // console.warn('[CurrentUser] Redis error during session validation, continuing with JWT:', {
                        //     error: err.message,
                        //     sessionUserId,
                        //     sessionId: payload.sessionId
                        // });
                    });
                }
                else {
                    // Redis not available, skip session validation
                    console.warn('Redis not available for session validation, continuing without it');
                }
            }
            catch (redisErr) {
                // Redis wrapper not available, continue without session validation
                console.warn('Redis not available for session validation, continuing without it');
            }
        }
        req.currentUser = payload;
    }
    catch (err) { }
    next();
};
exports.currentUser = currentUser;
