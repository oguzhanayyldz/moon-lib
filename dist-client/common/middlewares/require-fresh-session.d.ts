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
export interface RequireFreshSessionOptions {
    /**
     * Okuma hatasinin `next`'e hangi hata olarak iletilecegi. Varsayilan: hatanin kendisi
     * (`errorHandler` CustomError olmayani 400 yapar). Istek her durumda durdurulur.
     */
    mapLookupError?: (error: unknown) => unknown;
}
export declare const requireFreshSession: (lookup: SessionRevocationLookup, options?: RequireFreshSessionOptions) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
export interface RequireFreshSessionOnWritesOptions {
    /**
     * Esik okunamadiginda yanit (UC-923 N3). Varsayilan `'unavailable'`: 503 — gecici sunucu
     * sorunu. `'propagate'`: ham hata iletilir (`errorHandler` → 400), servis kopyalarinin
     * (UC-921/UC-922) eski davranisi. Iki durumda da istek uca ULASMAZ (fail-closed).
     */
    onLookupError?: 'unavailable' | 'propagate';
}
/**
 * Yazma yontemlerinde (POST/PUT/PATCH/DELETE) iptalden once baslamis erisim JWT'sini
 * reddeder (UC-921/UC-922 servis kopyalarinin tek hali, UC-923). `app.use(currentUser)`
 * SONRASINA, rotalardan ONCE takilir: tek noktadan butun yazma yuzeyini kapsar, yeni rota
 * eklendiginde unutulamaz. Oturumsuz istek (webhook vb.) `currentUser` yok → dokunulmaz;
 * kimlik denetimini rotanin kendi `requireAuth`'u yapar. Okuma uclari etkilenmez; TEK istisna
 * taklit (`isImpersonating`) JWT'sinde GET/HEAD de denetlenir (UC-1198): `id` hedef musterinin
 * kiracisini gosterir, pasiflestirilen admin kalan omru boyunca musteri verisini okuyamasin.
 * Esigin sahibi yine `adminId`; normal kullanicinin okumasi degismez.
 *
 * Sira: rate-limit'ten SONRA takilmasi onerilir — koruma her oturumlu yazmada bir indeksli
 * `findOne` yapar; once takilirsa sinira takilacak istek de DB'ye ulasir.
 */
export declare const requireFreshSessionOnWrites: (lookup: SessionRevocationLookup, options?: RequireFreshSessionOnWritesOptions) => (req: Request, res: Response, next: NextFunction) => void;
