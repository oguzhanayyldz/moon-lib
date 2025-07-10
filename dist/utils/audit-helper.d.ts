import { Request } from 'express';
import { UserRole } from '../common/types/user-role';
export interface AuditLogEntry {
    service: string;
    operation: string;
    resourceType: string;
    resourceId?: string;
    actualUserId: string;
    effectiveUserId: string;
    isSubUser: boolean;
    userRole: UserRole;
    parentUserId?: string;
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
export declare const createAuditLogEntry: (req: Request, serviceName: string, operation: string, resourceType: string, resourceId?: string, metadata?: any) => AuditLogEntry;
/**
 * Hata durumu için audit log entry oluşturur
 */
export declare const createErrorAuditLogEntry: (req: Request, serviceName: string, operation: string, resourceType: string, error: Error, resourceId?: string, metadata?: any) => AuditLogEntry;
/**
 * Audit log helper fonksiyonları
 */
export declare const logSubUserAction: (req: Request, serviceName: string, operation: string, resourceType: string, resourceId?: string, metadata?: any) => void;
/**
 * Hata durumunda audit log kaydı
 */
export declare const logSubUserError: (req: Request, serviceName: string, operation: string, resourceType: string, error: Error, resourceId?: string, metadata?: any) => void;
