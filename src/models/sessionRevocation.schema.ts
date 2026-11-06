import mongoose from 'mongoose';
import { SessionRevocationLookup } from '../common/middlewares/require-fresh-session';

/**
 * Oturum iptal damgasinin izdusumu (UC-921/UC-922 servis kopyalari → moon-lib, UC-923).
 *
 * Auth `UserSessionsRevoked` yayinlar; `BaseUserSessionsRevokedListener` damgayi buraya
 * `$max` + upsert ile yazar, `requireFreshSessionOnWrites` yalniz buradan okur. FOREIGN User
 * kopyasi damga tasimaz, alt kullanicinin kopyasi hic yok — bu yuzden ayri koleksiyon.
 *
 * Varlik degil, olayin izdusumu: `createBaseSchema` kullanilmaz (surum / soft delete anlamsiz).
 *
 * TTL: damga yalniz en uzun erisim JWT omru (taklit 1 saat) boyunca anlamli; sonrasinda o
 * oturumun token'i zaten gecersiz. 1 gun sonra kayit kendiliginden silinir. Yeni iptal `$max`
 * ile damgayi ileri tasir, TTL de onunla ilerler.
 *
 * Model adi, koleksiyon (`sessionrevocations`) ve indeksler servislerdeki kopyalarla AYNI:
 * gecis sirasinda mevcut kayitlar ve indeksler oldugu gibi kullanilir.
 */
export const SESSION_REVOCATION_TTL_SECONDS = 24 * 60 * 60;

export interface SessionRevocationDoc extends mongoose.Document {
    userId: string;
    sessionsRevokedAt: Date;
}

export const sessionRevocationSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    sessionsRevokedAt: { type: Date, required: true }
}, { timestamps: false, versionKey: false });

sessionRevocationSchema.index({ sessionsRevokedAt: 1 }, { expireAfterSeconds: SESSION_REVOCATION_TTL_SECONDS });

/** Izdusum anahtari harfe duyarli String: yazan ve okuyan ayni bicimi kullanmali (UC-870 N1). */
export const normalizeSessionRevocationUserId = (userId: unknown): string => String(userId).toLowerCase();

export function createSessionRevocationModel(connection: mongoose.Connection) {
    try {
        return connection.model<SessionRevocationDoc>('SessionRevocation');
    } catch {
        return connection.model<SessionRevocationDoc>('SessionRevocation', sessionRevocationSchema);
    }
}

/**
 * `requireFreshSessionOnWrites` icin izdusum okuyucusu. Kayit yoksa `null` → gecer (damga
 * henuz ulasmamis ya da hesap hic iptal edilmemis). Okuma hatasi FIRLAR → fail-closed.
 */
export const createSessionRevocationLookup = (connection: mongoose.Connection): SessionRevocationLookup => {
    const SessionRevocation = createSessionRevocationModel(connection);
    return async (userId) =>
        SessionRevocation.findOne({ userId: normalizeSessionRevocationUserId(userId) }).select('sessionsRevokedAt').lean();
};
