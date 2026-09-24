import { Request, Response, NextFunction } from 'express';
/**
 * Hesap duzeyindeki oturum iptalini auth disindaki servislerde uygular
 * (TASK-MUFJ7F2IFKC77).
 *
 * `currentUser` erisim JWT'sini yalniz imza ve sureyle dogrular: parola degisimi
 * ya da "tum cihazlardan cikis" sonrasinda eski erisim token'i 15 dk (taklitte
 * 1 saat) daha gecerliydi. Auth ayni denetimi kendi hassas uclarinda
 * `checkUserStatus` ile yapiyor; burada ayni karsilastirma, damganin FOREIGN
 * kopyasiyla (auth `UserSessionsRevoked` olayi → servisin User kopyasi) yapilir.
 *
 * Asagidaki iki yardimci auth'takilerle (`authSession.service.ts`
 * `tokenSessionStartedAt`, `sessionLifecycle.service.ts` `startedBeforeRevocation`)
 * AYNI kurali uygular. Fark: auth ayrica `passwordChangedAt`'e bakar; o alan olayla
 * tasinmiyor. Parolayi degistiren her yol `revokeAllSessions`'i cagirdigi surece
 * `sessionsRevokedAt` ayni esigi tasir.
 */
/**
 * Erisim JWT'sinin tasidigi oturum baslangici (ms).
 *
 * `sst` giriste basilir ve yenilemede TASINIR. `sst` tasimayan eski token'da
 * `iat`'e dusulur; `iat` saniye cozunurlugunde oldugu icin saniyenin SON ani
 * alinir — ayni saniyede acilmis mesru oturum reddedilmez.
 */
export declare const tokenSessionStartedAt: (claims: object) => number | undefined;
/**
 * `startedAt` aninda baslamis oturum, `revokedAt` iptalinden ONCE mi baslamis?
 *
 * Ayni milisaniye esitligi gecer (`<`): iptalden hemen sonra acilan giris yasamali.
 */
export declare const startedBeforeRevocation: (revokedAt: Date | null | undefined, startedAt: number) => boolean;
/** Servisin FOREIGN User kopyasindan okunan iptal esigi. */
export interface SessionRevocationRecord {
    sessionsRevokedAt?: Date | null;
}
/**
 * Esigin sahibini okur. Kopya yoksa `null` doner (esik yok → gecer); okuma
 * hatasi FIRLATMALIDIR (fail-closed).
 */
export type SessionRevocationLookup = (userId: string) => Promise<SessionRevocationRecord | null>;
/**
 * `requireAuth` (ya da `requireAuthAdmin`) SONRASINA takilir.
 *
 * Kurallar (lead karari, TASK-MUFJ7F2IFKC77):
 *   - Kopya yok → GECER (damga henuz ulasmamis ya da kullanici kopyalanmamis).
 *   - Okuma hatasi → FAIL-CLOSED: hata `next(error)` ile iletilir, uca gecilmez.
 *   - Iptalden once baslamis oturum → 401, YAN ETKISIZ (cerez silinmez, oturum
 *     kapatilmaz). Istemci 401'de yeniler; auth'un refresh zinciri ayni oturumu
 *     zaten reddeder.
 *   - `sst` de `iat` de yoksa baslangic bilinmiyor: esigi olan hesapta red.
 */
export declare const requireFreshSession: (lookup: SessionRevocationLookup) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
