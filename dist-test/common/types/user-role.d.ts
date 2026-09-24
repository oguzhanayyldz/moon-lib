export declare enum UserRole {
    Admin = 0,
    User = 1,
    SubUser = 2
}
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
export declare const parseUserRole: (value: unknown) => UserRole | undefined;
//# sourceMappingURL=user-role.d.ts.map