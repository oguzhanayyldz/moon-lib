import { Request, Response, NextFunction } from 'express';
import { NotAuthorizedError } from '../errors/not-authorized-error';
import { ServiceUnavailableError } from '../errors/service-unavailable-error';
import { logger } from '../../services/logger.service';

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
export const tokenSessionStartedAt = (claims: object): number | undefined => {
    const { sst, iat } = claims as { sst?: unknown; iat?: unknown };
    if (typeof sst === 'number') return sst;
    if (typeof iat === 'number') return iat * 1000 + 999;
    return undefined;
};

/**
 * `startedAt` aninda baslamis oturum, `revokedAt` iptalinden ONCE mi baslamis?
 *
 * Ayni milisaniye esitligi gecer (`<`): iptalden hemen sonra acilan giris yasamali.
 */
export const startedBeforeRevocation = (
    revokedAt: Date | null | undefined,
    startedAt: number
): boolean => Boolean(revokedAt && startedAt < new Date(revokedAt).getTime());

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
 * Esigin sahibi:
 *   - Taklitte ADMIN: taklit token'i adminin oturumundan turer (auth
 *     `impersonateUser.ts` `sst`'yi adminin JWT'sinden tasir). Hedefin kendi
 *     iptali admini dusurmez; adminin iptali taklidi dusurur.
 *   - Alt kullanici oturumunda alt kullanicinin KENDI id'si (auth
 *     `resolveSessionOwnerId` ile ayni) — JWT `id`'si ust hesabi gosterir.
 *   - Diger her durumda (admin uclari dahil) oturum sahibinin kendisi.
 * Taklitte `adminId` yoksa sahip bilinmiyor: `undefined` → red.
 */
const revocationHolderId = (user: NonNullable<Request['currentUser']>): string | undefined => {
    if (user.isImpersonating) {
        return user.adminId || undefined;
    }
    return user.isSubUserMode && user.subUserId ? user.subUserId : user.id;
};

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

export const requireFreshSession = (lookup: SessionRevocationLookup, options: RequireFreshSessionOptions = {}) =>
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const user = req.currentUser;
        if (!user) {
            return next();
        }

        const holderId = revocationHolderId(user);
        if (!holderId) {
            logger.info('[requireFreshSession] Impersonation token without adminId');
            return next(new NotAuthorizedError());
        }

        let holder: SessionRevocationRecord | null;
        try {
            holder = await lookup(holderId);
        } catch (error) {
            logger.error('[requireFreshSession] revocation lookup failed, blocking request:', error);
            // Eslemenin bos donusu `next()` olur ve istegi gecirirdi: hatanin kendisine dusulur
            return next(options.mapLookupError?.(error) ?? error);
        }

        if (!holder) {
            return next();
        }

        const sessionStartedAt = tokenSessionStartedAt(user) ?? Number.NEGATIVE_INFINITY;
        if (startedBeforeRevocation(holder.sessionsRevokedAt, sessionStartedAt)) {
            logger.info(`[requireFreshSession] Session predates account-wide revocation: ${holderId}`);
            return next(new NotAuthorizedError());
        }

        next();
    };

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

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
 * kimlik denetimini rotanin kendi `requireAuth`'u yapar. Okuma uclari etkilenmez.
 *
 * Sira: rate-limit'ten SONRA takilmasi onerilir — koruma her oturumlu yazmada bir indeksli
 * `findOne` yapar; once takilirsa sinira takilacak istek de DB'ye ulasir.
 */
export const requireFreshSessionOnWrites = (
    lookup: SessionRevocationLookup,
    options: RequireFreshSessionOnWritesOptions = {}
) => {
    const freshSession = requireFreshSession(lookup, {
        mapLookupError: options.onLookupError === 'propagate'
            ? undefined
            : () => new ServiceUnavailableError()
    });

    return (req: Request, res: Response, next: NextFunction): void => {
        if (READ_METHODS.has(req.method)) {
            return next();
        }
        freshSession(req, res, next).catch(next);
    };
};
