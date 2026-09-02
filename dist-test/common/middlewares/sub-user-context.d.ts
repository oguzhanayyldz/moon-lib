import { Request, Response, NextFunction } from 'express';
/**
 * Merkezi SubUser Context Middleware
 * Tüm servislerde kullanılabilir, request'e context bilgilerini ekler
 *
 * ⚠️ `X-Effective-User-Id`/`X-Actual-User-Id` header'ları BİLEREK okunmaz
 * (issue #653 — çapraz-tenant IDOR). Bu değerler istemciden gelen, imzasız
 * girdi; sunucu tarafı yetki sınırı olarak kullanılamaz. effectiveUserId/
 * actualUserId SADECE `req.currentUser`'daki imzalı JWT'den hesaplanır.
 */
export declare const subUserContext: (req: Request, res: Response, next: NextFunction) => void;
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
//# sourceMappingURL=sub-user-context.d.ts.map