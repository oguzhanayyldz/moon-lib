import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '../types/user-role';
import { redisWrapper } from '../../services/redisWrapper.service';

export interface UserPayload {
    id: string;
    email: string;
    name: string;
    surname: string;
    parentUser?: string;
    role: UserRole;
    sessionId?: string;
    isImpersonating?: boolean;
    adminId?: string;        // Admin impersonation için
    permissions?: any[];
    // SubUser mode fields
    isSubUserMode?: boolean;  // SubUser olarak login olundu mu
    subUserId?: string;       // SubUser'ın gerçek ID'si
    subUserEmail?: string;    // SubUser'ın email'i
    subUserRole?: UserRole;   // SubUser'ın rolü (her zaman SubUser)
}

// Helper functions for SubUser context
export const getEffectiveUserId = (user: UserPayload): string => {
    // For SubUsers, return parent user ID for data access
    // For regular users and admins, return their own ID
    return user.role === UserRole.SubUser && user.parentUser ? user.parentUser : user.id;
};

export const getActualUserId = (user: UserPayload): string => {
    // Always return the actual user ID for audit logging
    return user.id;
};

export const isSubUser = (user: UserPayload): boolean => {
    return user.role === UserRole.SubUser;
};

export const hasPermission = (user: UserPayload, resource: string, action: string): boolean => {
    // Convert role to number to ensure type safety
    const roleNumber = Number(user.role);
    
    // Admin and User roles have full access
    if (roleNumber === UserRole.Admin || roleNumber === UserRole.User) {
        // SubUser mode kontrolü - SubUser modunda ise permissions'a bak
        if (user.isSubUserMode && user.permissions) {
            const permission = user.permissions.find(p => p.resource === resource);
            return permission ? permission.actions.includes(action) || permission.actions.includes('*') : false;
        }
        return true;
    }

    // Direct SubUser login (should not happen with new flow)
    if (roleNumber === UserRole.SubUser && user.permissions) {
        const permission = user.permissions.find(p => p.resource === resource);
        return permission ? permission.actions.includes(action) || permission.actions.includes('*') : false;
    }

    return false;
};

declare global {
    namespace Express {
        interface Request {
            currentUser?: UserPayload;
        }
    }
}

export const currentUser = (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.jwt) {
        return next();
    }

    try {
        const payload = jwt.verify(req.session.jwt, process.env.JWT_KEY!) as UserPayload;
        
        // Session validation - if sessionId exists in JWT and Redis is available (make it non-blocking)
        if (payload.sessionId) {
            // Check if Redis is available before attempting session validation
            try {
                if (redisWrapper && redisWrapper.client) {
                    // For SubUser mode, use subUserId for session tracking, otherwise use payload.id
                    const sessionUserId = payload.isSubUserMode && payload.subUserId ? payload.subUserId : payload.id;
                    // Non-blocking session check - don't await
                    redisWrapper.client.hGet(`user_sessions:${sessionUserId}`, payload.sessionId)
                        .then(isSessionValid => {
                            if (!isSessionValid) {
                                // Session not found in Redis - but don't immediately clear JWT
                                // This could be a temporary Redis issue or TTL expiry
                                console.warn('[CurrentUser] Session not found in Redis, but keeping JWT for now:', {
                                    sessionUserId,
                                    sessionId: payload.sessionId,
                                    userEmail: payload.email,
                                    isSubUserMode: payload.isSubUserMode
                                });
                                // Note: NOT clearing JWT here - let currentUser endpoint handle this
                            } else {
                                // Update session activity (non-blocking)
                                try {
                                    const sessionData = JSON.parse(isSessionValid as string);
                                    sessionData.lastActivity = new Date();
                                    redisWrapper.client.hSet(`user_sessions:${sessionUserId}`, payload.sessionId!, JSON.stringify(sessionData))
                                        .catch(updateErr => {
                                            console.warn('[CurrentUser] Failed to update session activity:', updateErr.message);
                                        });
                                } catch {
                                    // If update fails, continue anyway
                                }
                            }
                        })
                        .catch(err => {
                            // Redis error - continue without session validation, don't clear JWT
                            console.warn('[CurrentUser] Redis error during session validation, continuing with JWT:', {
                                error: err.message,
                                sessionUserId,
                                sessionId: payload.sessionId
                            });
                        });
                } else {
                    // Redis not available, skip session validation
                    console.warn('Redis not available for session validation, continuing without it');
                }
            } catch (redisErr) {
                // Redis wrapper not available, continue without session validation
                console.warn('Redis not available for session validation, continuing without it');
            }
        }
        
        req.currentUser = payload;
    } catch (err) {}

    next();
};
