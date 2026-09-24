import { Subjects } from "./subjects";
/**
 * Kullanicinin TUM oturumlari hesap duzeyinde iptal edildi (TASK-MUFJ7F2IFKC77)
 *
 * Yayinlayan: auth — `revokeAllSessions` damgayi (`sessionsRevokedAt`) yazdiktan sonra
 *             outbox'a ekler (parola degisimi/sifirlama, pasiflestirme, "tum cihazlardan
 *             cikis", alt kullanici oturum iptali, OAuth birlestirme).
 * Dinleyen:   subscription — FOREIGN User kopyasina `$max` ile yazar; `requireFreshSession`
 *             bu esikten once baslamis oturumun erisim JWT'sini reddeder.
 *
 * NEDEN AYRI EVENT (UserUpdated'a alan eklenmedi): damga `updateOne` ile yaziliyor ve
 * `version` KASITLI OLARAK artmiyor (auth `revokeAllSessions` notu). Dinleyiciler
 * UserUpdated'i `version` ile eliyor; artmayan surumlu bir UserUpdated her kopyada
 * "zaten bu surumdeyim" diye atlanirdi. Damga yalniz ileri gider: dinleyici `$max`
 * ile yazar, sirasiz ya da tekrarli teslim sonucu degistirmez.
 */
export interface UserSessionsRevokedEvent {
    subject: Subjects.UserSessionsRevoked;
    data: {
        /** Damganin yazildigi kullanici (alt kullanicida alt kullanicinin KENDI id'si) */
        userId: string;
        /** Damga ani, ISO 8601 — auth'taki `sessionsRevokedAt` ile ayni deger */
        revokedAt: string;
    };
}
//# sourceMappingURL=user-sessions-revoked-event.d.ts.map