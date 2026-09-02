import { Request, Response, NextFunction } from 'express';
import { UserPayload, getEffectiveUserId, getActualUserId, isSubUser } from './current-user';

/**
 * Merkezi SubUser Context Middleware
 * Tüm servislerde kullanılabilir, request'e context bilgilerini ekler
 *
 * ⚠️ `X-Effective-User-Id`/`X-Actual-User-Id` header'ları BİLEREK okunmaz
 * (issue #653 — çapraz-tenant IDOR). Bu değerler istemciden gelen, imzasız
 * girdi; sunucu tarafı yetki sınırı olarak kullanılamaz. effectiveUserId/
 * actualUserId SADECE `req.currentUser`'daki imzalı JWT'den hesaplanır.
 */
export const subUserContext = (req: Request, res: Response, next: NextFunction) => {
    // Eğer currentUser varsa, context bilgilerini ayıkla
    if (req.currentUser) {
        // Helper method'ları kullanarak context bilgilerini al
        const effectiveUserId = getEffectiveUserId(req.currentUser);
        const actualUserId = getActualUserId(req.currentUser);

        // Request'e context bilgilerini ekle
        (req as any).effectiveUserId = effectiveUserId;
        (req as any).actualUserId = actualUserId;
        (req as any).isSubUser = isSubUser(req.currentUser);

        // Audit logging için orijinal user bilgilerini sakla
        (req as any).auditContext = {
            actualUserId: actualUserId,
            effectiveUserId: effectiveUserId,
            isSubUser: isSubUser(req.currentUser),
            userRole: req.currentUser.role,
            parentUserId: req.currentUser.parentUser
        };
    }
    
    next();
};

// TypeScript type extensions
declare global {
    namespace Express {
        interface Request {
            effectiveUserId?: string;
            actualUserId?: string;
            isSubUser?: boolean;
            auditContext?: {
                actualUserId: string;
                effectiveUserId: string;
                isSubUser: boolean;
                userRole: string;
                parentUserId?: string;
            };
        }
    }
}