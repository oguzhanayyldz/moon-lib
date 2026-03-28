import { Request, Response, NextFunction } from 'express';
/**
 * Merkezi SubUser Context Middleware
 * Tüm servislerde kullanılabilir, request'e context bilgilerini ekler
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
