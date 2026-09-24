"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseUserRole = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole[UserRole["Admin"] = 0] = "Admin";
    UserRole[UserRole["User"] = 1] = "User";
    UserRole[UserRole["SubUser"] = 2] = "SubUser";
})(UserRole || (exports.UserRole = UserRole = {}));
/**
 * ⚠️ ROL KARARLARI YALNIZ BU AYRISTIRICIDAN GECER (SEC-1-SESS-D, TASK-MU1IV0YVNG85F)
 *
 * Rol JWT'de STRING (`"1"`), kodda NUMBER (`UserRole.User`) tasiniyor (issue #651).
 * `Number(role)` bu farki kapatiyordu ama bozuk degerleri EN YUKSEK yetkiye
 * esliyordu: `Number("") === Number(false) === Number(" 0 ") === Number([]) === 0`
 * yani `UserRole.Admin`. Bilinmeyen deger admin kapisini aciyordu (fail-open).
 *
 * Kati kural: yalniz `0 | 1 | 2` ve tam olarak `"0" | "1" | "2"` gecerli. Geri
 * kalan her sey `undefined` → hicbir `UserRole` ile eslesmez, her rol kapisinda
 * RED (fail-closed). Bilinmeyen deger `SubUser`'a DUSURULMEZ: `SubUser`
 * abonelik/onboarding kapilarindan muaf, yani "en dusuk" degil.
 */
const parseUserRole = (value) => {
    switch (value) {
        case UserRole.Admin:
        case '0':
            return UserRole.Admin;
        case UserRole.User:
        case '1':
            return UserRole.User;
        case UserRole.SubUser:
        case '2':
            return UserRole.SubUser;
        default:
            return undefined;
    }
};
exports.parseUserRole = parseUserRole;
