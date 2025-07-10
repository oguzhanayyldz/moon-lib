import { Request } from 'express';
import { UserRole } from '../common/types/user-role';

export interface AuditLogEntry {
    service: string;
    operation: string;
    resourceType: string;
    resourceId?: string;
    actualUserId: string;        // SubUser'ın gerçek ID'si
    effectiveUserId: string;     // Parent user ID'si (data owner)
    isSubUser: boolean;
    userRole: UserRole;
    parentUserId?: string;       // Parent user ID
    success: boolean;
    error?: string;
    metadata?: any;
    timestamp: Date;
    ip?: string;
    userAgent?: string;
}

/**
 * SubUser context için audit log entry oluşturur
 */
export const createAuditLogEntry = (
    req: Request,
    serviceName: string,
    operation: string,
    resourceType: string,
    resourceId?: string,
    metadata?: any
): AuditLogEntry => {
    const currentUser = req.currentUser;
    
    return {
        service: serviceName,
        operation,
        resourceType,
        resourceId,
        actualUserId: currentUser?.subUserId || currentUser?.id || 'unknown',
        effectiveUserId: currentUser?.id || 'unknown',
        isSubUser: currentUser?.isSubUserMode || false,
        userRole: currentUser?.role || UserRole.SubUser,
        parentUserId: currentUser?.isSubUserMode ? currentUser?.id : undefined,
        success: true,
        metadata,
        timestamp: new Date(),
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.get('User-Agent')
    };
};

/**
 * Hata durumu için audit log entry oluşturur
 */
export const createErrorAuditLogEntry = (
    req: Request,
    serviceName: string,
    operation: string,
    resourceType: string,
    error: Error,
    resourceId?: string,
    metadata?: any
): AuditLogEntry => {
    const entry = createAuditLogEntry(req, serviceName, operation, resourceType, resourceId, metadata);
    
    return {
        ...entry,
        success: false,
        error: error.message
    };
};

/**
 * Audit log helper fonksiyonları
 */
export const logSubUserAction = (
    req: Request,
    serviceName: string,
    operation: string,
    resourceType: string,
    resourceId?: string,
    metadata?: any
): void => {
    const entry = createAuditLogEntry(req, serviceName, operation, resourceType, resourceId, metadata);
    
    // Console'a yazdır (production'da database'e kaydedilebilir)
    console.log('[AUDIT LOG]', JSON.stringify(entry, null, 2));
};

/**
 * Hata durumunda audit log kaydı
 */
export const logSubUserError = (
    req: Request,
    serviceName: string,
    operation: string,
    resourceType: string,
    error: Error,
    resourceId?: string,
    metadata?: any
): void => {
    const entry = createErrorAuditLogEntry(req, serviceName, operation, resourceType, error, resourceId, metadata);
    
    // Console'a yazdır (production'da database'e kaydedilebilir)
    console.log('[AUDIT LOG]', JSON.stringify(entry, null, 2));
};