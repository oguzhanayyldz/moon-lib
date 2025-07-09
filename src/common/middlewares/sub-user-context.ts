import { Request, Response, NextFunction } from 'express';
import { UserPayload, getEffectiveUserId, getActualUserId, isSubUser } from './current-user';

/**
 * Merkezi SubUser Context Middleware
 * Tüm servislerde kullanılabilir, request'e context bilgilerini ekler
 */
export const subUserContext = (req: Request, res: Response, next: NextFunction) => {
    // X-Effective-User-Id ve X-Actual-User-Id header'larını kontrol et
    const effectiveUserIdHeader = req.headers['x-effective-user-id'] as string;
    const actualUserIdHeader = req.headers['x-actual-user-id'] as string;
    
    // Eğer currentUser varsa, context bilgilerini ayıkla
    if (req.currentUser) {
        // Helper method'ları kullanarak context bilgilerini al
        const effectiveUserId = getEffectiveUserId(req.currentUser);
        const actualUserId = getActualUserId(req.currentUser);
        
        // Request'e context bilgilerini ekle
        (req as any).effectiveUserId = effectiveUserId;
        (req as any).actualUserId = actualUserId;
        (req as any).isSubUser = isSubUser(req.currentUser);
        
        // Header'dan gelen bilgileri de kontrol et (admin impersonation için)
        if (effectiveUserIdHeader && actualUserIdHeader) {
            // Header'dan gelen bilgileri kullan (admin impersonation durumu)
            (req as any).effectiveUserId = effectiveUserIdHeader;
            (req as any).actualUserId = actualUserIdHeader;
        }
        
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