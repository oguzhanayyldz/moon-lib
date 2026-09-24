import { Request, Response, NextFunction } from 'express';
import { NotAuthorizedError } from '../errors/not-authorized-error';
import { UserRole, parseUserRole } from '../types/user-role';
import { isSubUser } from './current-user';

export const requireAuthAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.currentUser) {
        throw new NotAuthorizedError();
    }

    if (parseUserRole(req.currentUser.role) !== UserRole.Admin) {
        throw new NotAuthorizedError();
    }

    // ⚠️ `role` TEK BASINA ADMIN KANITI DEGIL: alt kullanici JWT'sinde `role`
    // HESAP SAHIBININ rolu (`buildLoginJwtPayload`, auth). Admin hesabinin alt
    // kullanicisi `{ role: 0, isSubUserMode: true }` tasir ve yukaridaki kontrolu
    // gecer; izinleri ne olursa olsun platform geneli admin rotalarina erisirdi.
    // Admin taklidi etkilenmez: taklit JWT'sinde `role` taklit edilen hesabin
    // gercek rolu, `isSubUserMode` hic yazilmaz (`impersonateUser.ts`).
    if (isSubUser(req.currentUser)) {
        throw new NotAuthorizedError();
    }

    next();
};
