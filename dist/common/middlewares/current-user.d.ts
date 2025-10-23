import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types/user-role';
export interface UserPayload {
    id: string;
    email: string;
    name: string;
    surname: string;
    parentUser?: string;
    role: UserRole;
    sessionId?: string;
    isImpersonating?: boolean;
    adminId?: string;
    permissions?: any[];
    isSubUserMode?: boolean;
    subUserId?: string;
    subUserEmail?: string;
    subUserRole?: UserRole;
}
export declare const getEffectiveUserId: (user: UserPayload) => string;
export declare const getActualUserId: (user: UserPayload) => string;
export declare const isSubUser: (user: UserPayload) => boolean;
export declare const hasPermission: (user: UserPayload, resource: string, action: string) => boolean;
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
export declare const hasPlatformPermission: (user: UserPayload, resource: string, action: string, platformName?: string) => boolean;
declare global {
    namespace Express {
        interface Request {
            currentUser?: UserPayload;
        }
    }
}
export declare const currentUser: (req: Request, res: Response, next: NextFunction) => void;
