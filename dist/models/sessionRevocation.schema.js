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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSessionRevocationLookup = exports.normalizeSessionRevocationUserId = exports.sessionRevocationSchema = exports.SESSION_REVOCATION_TTL_SECONDS = void 0;
exports.createSessionRevocationModel = createSessionRevocationModel;
const mongoose_1 = __importDefault(require("mongoose"));
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
exports.SESSION_REVOCATION_TTL_SECONDS = 24 * 60 * 60;
exports.sessionRevocationSchema = new mongoose_1.default.Schema({
    userId: { type: String, required: true, unique: true },
    sessionsRevokedAt: { type: Date, required: true }
}, { timestamps: false, versionKey: false });
exports.sessionRevocationSchema.index({ sessionsRevokedAt: 1 }, { expireAfterSeconds: exports.SESSION_REVOCATION_TTL_SECONDS });
/** Izdusum anahtari harfe duyarli String: yazan ve okuyan ayni bicimi kullanmali (UC-870 N1). */
const normalizeSessionRevocationUserId = (userId) => String(userId).toLowerCase();
exports.normalizeSessionRevocationUserId = normalizeSessionRevocationUserId;
function createSessionRevocationModel(connection) {
    try {
        return connection.model('SessionRevocation');
    }
    catch (_a) {
        return connection.model('SessionRevocation', exports.sessionRevocationSchema);
    }
}
/**
 * `requireFreshSessionOnWrites` icin izdusum okuyucusu. Kayit yoksa `null` → gecer (damga
 * henuz ulasmamis ya da hesap hic iptal edilmemis). Okuma hatasi FIRLAR → fail-closed.
 */
const createSessionRevocationLookup = (connection) => {
    const SessionRevocation = createSessionRevocationModel(connection);
    return (userId) => __awaiter(void 0, void 0, void 0, function* () { return SessionRevocation.findOne({ userId: (0, exports.normalizeSessionRevocationUserId)(userId) }).select('sessionsRevokedAt').lean(); });
};
exports.createSessionRevocationLookup = createSessionRevocationLookup;
