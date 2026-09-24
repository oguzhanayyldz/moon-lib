"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireFreshSession = exports.startedBeforeRevocation = exports.tokenSessionStartedAt = void 0;
const not_authorized_error_1 = require("../errors/not-authorized-error");
const logger_service_1 = require("../../services/logger.service");
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
const tokenSessionStartedAt = (claims) => {
    const { sst, iat } = claims;
    if (typeof sst === 'number')
        return sst;
    if (typeof iat === 'number')
        return iat * 1000 + 999;
    return undefined;
};
exports.tokenSessionStartedAt = tokenSessionStartedAt;
/**
 * `startedAt` aninda baslamis oturum, `revokedAt` iptalinden ONCE mi baslamis?
 *
 * Ayni milisaniye esitligi gecer (`<`): iptalden hemen sonra acilan giris yasamali.
 */
const startedBeforeRevocation = (revokedAt, startedAt) => Boolean(revokedAt && startedAt < new Date(revokedAt).getTime());
exports.startedBeforeRevocation = startedBeforeRevocation;
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
const revocationHolderId = (user) => {
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
const requireFreshSession = (lookup) => async (req, res, next) => {
    var _a;
    const user = req.currentUser;
    if (!user) {
        return next();
    }
    const holderId = revocationHolderId(user);
    if (!holderId) {
        logger_service_1.logger.info('[requireFreshSession] Impersonation token without adminId');
        return next(new not_authorized_error_1.NotAuthorizedError());
    }
    let holder;
    try {
        holder = await lookup(holderId);
    }
    catch (error) {
        logger_service_1.logger.error('[requireFreshSession] revocation lookup failed, blocking request:', error);
        return next(error);
    }
    if (!holder) {
        return next();
    }
    const sessionStartedAt = (_a = (0, exports.tokenSessionStartedAt)(user)) !== null && _a !== void 0 ? _a : Number.NEGATIVE_INFINITY;
    if ((0, exports.startedBeforeRevocation)(holder.sessionsRevokedAt, sessionStartedAt)) {
        logger_service_1.logger.info(`[requireFreshSession] Session predates account-wide revocation: ${holderId}`);
        return next(new not_authorized_error_1.NotAuthorizedError());
    }
    next();
};
exports.requireFreshSession = requireFreshSession;
//# sourceMappingURL=require-fresh-session.js.map