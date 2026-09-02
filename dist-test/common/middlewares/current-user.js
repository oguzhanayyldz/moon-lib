"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.currentUser = exports.hasPlatformPermission = exports.hasPermission = exports.getActualUserId = exports.getEffectiveUserId = exports.isSubUser = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_role_1 = require("../types/user-role");
const redisWrapper_service_1 = require("../../services/redisWrapper.service");
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
const isSubUser = (user) => {
    return user.isSubUserMode === true || Number(user.role) === user_role_1.UserRole.SubUser;
};
exports.isSubUser = isSubUser;
/**
 * ⚠️ `isSubUser()` ile AYNI iki sinyali kullanir (issue #653) — daha once
 * yalnizca `isSubUserMode`'a bakiyordu, bu yuzden admin taklit akisinda
 * (`impersonateUser.ts`, `isSubUserMode` YAZILMAZ, `role` gercekten SubUser)
 * `parentUser` yerine taklit edilenin KENDI id'sini donduruyordu. O bosluk
 * daha once istemciden gelen `X-Effective-User-Id` header'iyla (guvensiz)
 * kapatiliyordu; header kaldirildiginda bu fonksiyon dogru degeri TEK BASINA
 * uretebilmeli.
 */
const getEffectiveUserId = (user) => {
    // For SubUsers, return parent user ID for data access
    // For regular users and admins, return their own ID
    return (0, exports.isSubUser)(user) && user.parentUser ? user.parentUser : user.id;
};
exports.getEffectiveUserId = getEffectiveUserId;
const getActualUserId = (user) => {
    // Always return the actual user ID for audit logging
    return user.id;
};
exports.getActualUserId = getActualUserId;
const hasPermission = (user, resource, action) => {
    // Convert role to number to ensure type safety
    const roleNumber = Number(user.role);
    // Admin and User roles have full access
    if (roleNumber === user_role_1.UserRole.Admin || roleNumber === user_role_1.UserRole.User) {
        // SubUser mode kontrolü - SubUser modunda ise permissions'a bak
        if (user.isSubUserMode && user.permissions) {
            const permission = user.permissions.find(p => p.resource === resource);
            return permission ? permission.actions.includes(action) || permission.actions.includes('*') : false;
        }
        return true;
    }
    // Direct SubUser login (should not happen with new flow)
    if (roleNumber === user_role_1.UserRole.SubUser && user.permissions) {
        const permission = user.permissions.find(p => p.resource === resource);
        return permission ? permission.actions.includes(action) || permission.actions.includes('*') : false;
    }
    return false;
};
exports.hasPermission = hasPermission;
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
const hasPlatformPermission = (user, resource, action, platformName) => {
    var _a, _b;
    // First check basic permission
    if (!(0, exports.hasPermission)(user, resource, action)) {
        return false;
    }
    // If no platform check needed, return true
    if (!platformName) {
        return true;
    }
    // Convert role to number
    const roleNumber = Number(user.role);
    // Admin and User roles - check if SubUser mode
    if (roleNumber === user_role_1.UserRole.Admin || roleNumber === user_role_1.UserRole.User) {
        if (user.isSubUserMode && user.permissions) {
            const permission = user.permissions.find(p => p.resource === resource && (p.actions.includes(action) || p.actions.includes('*')));
            // Check platform constraints
            if ((_a = permission === null || permission === void 0 ? void 0 : permission.constraints) === null || _a === void 0 ? void 0 : _a.platforms) {
                return permission.constraints.platforms.includes(platformName);
            }
            // No platform constraint means all platforms allowed
            return true;
        }
        // Not SubUser mode means full access
        return true;
    }
    // Direct SubUser login
    if (roleNumber === user_role_1.UserRole.SubUser && user.permissions) {
        const permission = user.permissions.find(p => p.resource === resource && (p.actions.includes(action) || p.actions.includes('*')));
        // Check platform constraints
        if ((_b = permission === null || permission === void 0 ? void 0 : permission.constraints) === null || _b === void 0 ? void 0 : _b.platforms) {
            return permission.constraints.platforms.includes(platformName);
        }
        // No platform constraint means all platforms allowed
        return true;
    }
    return false;
};
exports.hasPlatformPermission = hasPlatformPermission;
/**
 * ⚠️ `Number(...)` TEK BASINA GUVENLI DEGIL (issue #651 guvenlik incelemesi):
 * `Number(null) === 0 === UserRole.Admin`. Normalizasyon eklenmeden ONCE
 * `null != UserRole.Admin` (gevsek karsilastirma) DOGRU sekilde reddediyordu;
 * `Number(null)` sonrasi `0 != 0` false olup SESSIZCE ADMIN yetkisi verilirdi
 * — normalizasyonun kendisinin actigi bir fail-open.
 *
 * `null`/`undefined` (rol hic yok) `NaN`'a eslenir — hicbir `UserRole` degeriyle
 * ESLESMEZ, yani hem gevsek hem kati karsilastirmalarda GUVENLI sekilde
 * reddedilir. Bos string/dizi/`false` gibi diger "sahte sifir" degerler zaten
 * ONCEDEN de gevsek (`!=`) karsilastirmalarda kazara gecebiliyordu — bu, bu
 * PR'in kapsami DISINDA (issue #651 yalnizca dogru bicimli roldeki tip
 * uyumsuzlugunu hedefliyor).
 */
const normalizeRole = (role) => role === null || role === undefined ? NaN : Number(role);
const currentUser = (req, res, next) => {
    var _a;
    if (!((_a = req.session) === null || _a === void 0 ? void 0 : _a.jwt)) {
        return next();
    }
    try {
        const payload = jsonwebtoken_1.default.verify(req.session.jwt, process.env.JWT_KEY);
        // ⚠️ ROL NORMALIZASYONU — issue #651
        //
        // `UserPayload.role` tipi `UserRole` (NUMBER) diyor ama JWT'de STRING
        // tasiniyor: sema `role: { type: String, enum: … }` ve giris akislari
        // degeri oldugu gibi yaziyor (`"1"`). Tip bildiriminin yalan soylemesi
        // yuzunden `role === UserRole.User` gibi her karsilastirma sessizce
        // `false` donuyordu — derleyici uyarmiyor, testler de yakalamiyordu
        // (`test/setup.ts` JWT'yi number rolle uretiyor).
        //
        // Somut sonuclari: `invalidate-subuser-sessions` parent'a HER ZAMAN 403
        // donuyordu (issue #650'de bulundu), `deleteUser`'daki "admin silinemez"
        // korumasi hic devreye girmiyordu.
        //
        // ⚠️ NORMALIZASYON BURADA, OKUMA NOKTASINDA yapiliyor — JWT'ye yazarken
        // degil: dolasimda 7 gune kadar eski (string rollu) token var ve onlar
        // da bu yoldan geciyor. Yazma noktasinda duzeltilseydi o token'lar
        // omurlerinin sonuna kadar kirik davranmaya devam ederdi.
        payload.role = normalizeRole(payload.role);
        if (payload.subUserRole !== undefined) {
            payload.subUserRole = normalizeRole(payload.subUserRole);
        }
        // Session validation - if sessionId exists in JWT and Redis is available (make it non-blocking)
        if (payload.sessionId) {
            // Check if Redis is available before attempting session validation
            try {
                if (redisWrapper_service_1.redisWrapper && redisWrapper_service_1.redisWrapper.client) {
                    // For SubUser mode, use subUserId for session tracking, otherwise use payload.id
                    const sessionUserId = payload.isSubUserMode && payload.subUserId ? payload.subUserId : payload.id;
                    // Non-blocking session check - don't await
                    redisWrapper_service_1.redisWrapper.client.hGet(`user_sessions:${sessionUserId}`, payload.sessionId)
                        .then(isSessionValid => {
                        if (!isSessionValid) {
                            // Session not found in Redis - but don't immediately clear JWT
                            // This could be a temporary Redis issue or TTL expiry
                            // console.warn('[CurrentUser] Session not found in Redis, but keeping JWT for now:', {
                            //     sessionUserId,
                            //     sessionId: payload.sessionId,
                            //     userEmail: payload.email,
                            //     isSubUserMode: payload.isSubUserMode
                            // });
                            // Note: NOT clearing JWT here - let currentUser endpoint handle this
                        }
                        else {
                            // Update session activity (non-blocking)
                            try {
                                const sessionData = JSON.parse(isSessionValid);
                                sessionData.lastActivity = new Date();
                                redisWrapper_service_1.redisWrapper.client.hSet(`user_sessions:${sessionUserId}`, payload.sessionId, JSON.stringify(sessionData))
                                    .catch(updateErr => {
                                    // console.warn('[CurrentUser] Failed to update session activity:', updateErr.message);
                                });
                            }
                            catch (_a) {
                                // If update fails, continue anyway
                            }
                        }
                    })
                        .catch(err => {
                        // Redis error - continue without session validation, don't clear JWT
                        // console.warn('[CurrentUser] Redis error during session validation, continuing with JWT:', {
                        //     error: err.message,
                        //     sessionUserId,
                        //     sessionId: payload.sessionId
                        // });
                    });
                }
                else {
                    // Redis not available, skip session validation
                    console.warn('Redis not available for session validation, continuing without it');
                }
            }
            catch (redisErr) {
                // Redis wrapper not available, continue without session validation
                console.warn('Redis not available for session validation, continuing without it');
            }
        }
        req.currentUser = payload;
    }
    catch (err) { }
    next();
};
exports.currentUser = currentUser;
//# sourceMappingURL=current-user.js.map