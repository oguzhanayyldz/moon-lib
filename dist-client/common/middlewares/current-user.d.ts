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
    emailVerified?: boolean;
    onboardingCompleted?: boolean;
}
/**
 * ⚠️ ALT KULLANICI TESPITI `role` ILE YAPILAMAZ — issue #651
 *
 * Giris akisi alt kullaniciya "otomatik impersonation" uyguluyor: JWT'ye
 * `role` olarak PARENT'IN rolu yaziliyor (`buildLoginJwtPayload`), alt
 * kullanicinin kendi rolu `subUserRole` alaninda ayri tasiniyor. Yani bir alt
 * kullanicinin JWT'sinde `role` HICBIR ZAMAN `UserRole.SubUser` DEGILDIR.
 *
 * `role === UserRole.SubUser` kalibi bu yuzden iki kez hataliydi: hem tip
 * (string/number) hem de yanlis alan. Rol normalizasyonu (bkz. `currentUser`)
 * yalnizca birincisini cozer; dogru sinyal `isSubUserMode`.
 */
/**
 * ⚠️ SADECE `isSubUserMode` da YETERSIZ (guvenlik incelemesi, issue #651): bu
 * bayrak yalnizca NORMAL giris akisinda (`buildLoginJwtPayload`) yaziliyor.
 * Iki KENAR durumda role=SubUser oldugu halde `isSubUserMode` YAZILMIYOR:
 *   1. `impersonateUser.ts` — admin bir alt kullaniciyi taklit ederken uretilen
 *      JWT'de bu alan hic yok.
 *   2. `buildLoginJwtPayload`'in "orphan" dali — `parentUser` alani bos bir
 *      alt kullanici (semada zorunlu degil) normal kullanici gibi donuyor.
 * `Number(role) === UserRole.SubUser` yedek sinyal olarak eklendi: normal akista
 * hicbir zaman dogru olmuyordu (role = PARENT'IN rolu), bu iki kenar durumda ise
 * `role` GERCEKTEN `SubUser`. Ikisinin OR'u hem yaygin hem nadir yolu kapatiyor.
 */
export declare const isSubUser: (user: UserPayload) => boolean;
/**
 * ⚠️ `isSubUser()` ile AYNI iki sinyali kullanir (issue #653) — daha once
 * yalnizca `isSubUserMode`'a bakiyordu, bu yuzden admin taklit akisinda
 * (`impersonateUser.ts`, `isSubUserMode` YAZILMAZ, `role` gercekten SubUser)
 * `parentUser` yerine taklit edilenin KENDI id'sini donduruyordu. O bosluk
 * daha once istemciden gelen `X-Effective-User-Id` header'iyla (guvensiz)
 * kapatiliyordu; header kaldirildiginda bu fonksiyon dogru degeri TEK BASINA
 * uretebilmeli.
 */
export declare const getEffectiveUserId: (user: UserPayload) => string;
export declare const getActualUserId: (user: UserPayload) => string;
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
