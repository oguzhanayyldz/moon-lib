"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireFreshSessionOnWrites = exports.requireFreshSession = exports.startedBeforeRevocation = exports.tokenSessionStartedAt = void 0;
const not_authorized_error_1 = require("../errors/not-authorized-error");
const service_unavailable_error_1 = require("../errors/service-unavailable-error");
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
const requireFreshSession = (lookup, options = {}) => (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
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
        holder = yield lookup(holderId);
    }
    catch (error) {
        logger_service_1.logger.error('[requireFreshSession] revocation lookup failed, blocking request:', error);
        // Eslemenin bos donusu `next()` olur ve istegi gecirirdi: hatanin kendisine dusulur
        return next((_b = (_a = options.mapLookupError) === null || _a === void 0 ? void 0 : _a.call(options, error)) !== null && _b !== void 0 ? _b : error);
    }
    if (!holder) {
        return next();
    }
    const sessionStartedAt = (_c = (0, exports.tokenSessionStartedAt)(user)) !== null && _c !== void 0 ? _c : Number.NEGATIVE_INFINITY;
    if ((0, exports.startedBeforeRevocation)(holder.sessionsRevokedAt, sessionStartedAt)) {
        logger_service_1.logger.info(`[requireFreshSession] Session predates account-wide revocation: ${holderId}`);
        return next(new not_authorized_error_1.NotAuthorizedError());
    }
    next();
});
exports.requireFreshSession = requireFreshSession;
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
// Taklitte OPTIONS (CORS preflight) kimliksiz gelir; yalniz veri okuyan GET/HEAD kapiya girer
const IMPERSONATION_GATED_READ_METHODS = new Set(['GET', 'HEAD']);
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
const requireFreshSessionOnWrites = (lookup, options = {}) => {
    const freshSession = (0, exports.requireFreshSession)(lookup, {
        mapLookupError: options.onLookupError === 'propagate'
            ? undefined
            : () => new service_unavailable_error_1.ServiceUnavailableError()
    });
    return (req, res, next) => {
        var _a;
        const gatedRead = ((_a = req.currentUser) === null || _a === void 0 ? void 0 : _a.isImpersonating)
            && IMPERSONATION_GATED_READ_METHODS.has(req.method);
        if (READ_METHODS.has(req.method) && !gatedRead) {
            return next();
        }
        freshSession(req, res, next).catch(next);
    };
};
exports.requireFreshSessionOnWrites = requireFreshSessionOnWrites;
