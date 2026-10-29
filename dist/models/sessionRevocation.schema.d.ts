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
export declare const SESSION_REVOCATION_TTL_SECONDS: number;
export interface SessionRevocationDoc extends mongoose.Document {
    userId: string;
    sessionsRevokedAt: Date;
}
export declare const sessionRevocationSchema: mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: false;
    versionKey: false;
}, {
    userId: string;
    sessionsRevokedAt: Date;
}, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    userId: string;
    sessionsRevokedAt: Date;
}>> & mongoose.FlatRecord<{
    userId: string;
    sessionsRevokedAt: Date;
}> & {
    _id: mongoose.Types.ObjectId;
}>;
/** Izdusum anahtari harfe duyarli String: yazan ve okuyan ayni bicimi kullanmali (UC-870 N1). */
export declare const normalizeSessionRevocationUserId: (userId: unknown) => string;
export declare function createSessionRevocationModel(connection: mongoose.Connection): mongoose.Model<SessionRevocationDoc, {}, {}, {}, mongoose.Document<unknown, {}, SessionRevocationDoc> & SessionRevocationDoc & {
    _id: mongoose.Types.ObjectId;
}, any>;
/**
 * `requireFreshSessionOnWrites` icin izdusum okuyucusu. Kayit yoksa `null` → gecer (damga
 * henuz ulasmamis ya da hesap hic iptal edilmemis). Okuma hatasi FIRLAR → fail-closed.
 */
export declare const createSessionRevocationLookup: (connection: mongoose.Connection) => SessionRevocationLookup;
