import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types/user-role';
interface UserPayload {
    id: string;
    email: string;
    name: string;
    surname: string;
    parentUser: string;
    role: UserRole;
    sessionId?: string;
    isImpersonating?: boolean;
}
declare global {
    namespace Express {
        interface Request {
            currentUser?: UserPayload;
        }
    }
}
export declare const currentUser: (req: Request, res: Response, next: NextFunction) => void;
export {};
//# sourceMappingURL=current-user.d.ts.map