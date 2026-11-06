"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMMAND_CREDENTIAL_PLAIN_KEYS = exports.SEAL_COMMAND_CREDENTIALS_ENV = void 0;
exports.isCommandCredentialSealingEnabled = isCommandCredentialSealingEnabled;
exports.toCommandUserId = toCommandUserId;
exports.sealCommandCredentials = sealCommandCredentials;
exports.unsealCommandCredentials = unsealCommandCredentials;
exports.sealIntegrationCommandData = sealIntegrationCommandData;
const encryption_util_1 = require("./encryption.util");
const logger_service_1 = require("../services/logger.service");
/**
 * UC-1408 (Y-1): `integration:command` yükündeki credential'ların aktarım koruması.
 *
 * Sorun: yayıncılar (integration, shipment, invoice…) `CredentialsService.mergeAndParse` ile
 * şifresi çözülmüş credential'ları komut yüküne koyuyordu. Bu yük outbox'ta 180 gün, STAN
 * deposunda 14 gün düz metin duruyordu; `credentials.user` alanına da tam User belgesi
 * (ad/soyad/e-posta) yazılıyordu.
 *
 * Çözüm:
 *  - `user` her zaman yalnız kimlik (string) taşınır — koşulsuz. Platform tarafında
 *    `BaseIntegration.setup` bu alanı zaten `user` argümanıyla eziyor; tam belgeye ihtiyaç yok.
 *  - Yönlendirme anahtarları dışındaki TÜM üst seviye string değerler AES-256-GCM ile
 *    mühürlenir (`iv:authTag:ciphertext`). makeSafe şablonu yayıncı servislerde olmadığından
 *    "hepsini mühürle" kuralı seçildi: makeSafe işaretsiz ya da eski düz saklanan gizli
 *    değerler de böylece korunur.
 *  - Tüketici (`BaseIntegration.setup`) mühürlü değerleri çözer. Düz değerler olduğu gibi
 *    geçer → eski şekilli kayıtların (180 gün outbox replay) işlenmesi bozulmaz.
 *
 * İki fazlı yayın: mühürleme `SEAL_INTEGRATION_COMMAND_CREDENTIALS=true` ile açılır. Önce
 * çözebilen tüketiciler yayına girer (bayrak kapalı), sonra yayıncı pod'larında bayrak açılır.
 * Bayrak kapalıyken eski pod'lar şifreli değer alıp platform API'sine göndermez
 * (yanlış kimlik → authFailureTracker → entegrasyonun kapanması riski).
 */
exports.SEAL_COMMAND_CREDENTIALS_ENV = 'SEAL_INTEGRATION_COMMAND_CREDENTIALS';
/** Mühürlenmeyen, yönlendirme/kimlik amaçlı anahtarlar (gizli değil, düz kalmalı). */
exports.COMMAND_CREDENTIAL_PLAIN_KEYS = new Set([
    'user',
    'platform',
    'integration_active',
    'integrationId'
]);
function isCommandCredentialSealingEnabled() {
    return process.env[exports.SEAL_COMMAND_CREDENTIALS_ENV] === 'true' && !!process.env.ENCRYPTION_KEY;
}
/** Tam User belgesi / { id } / ObjectId → yalnız kimlik string'i. String ise aynen döner. */
function toCommandUserId(user) {
    var _a;
    if (user === null || user === undefined || typeof user === 'string')
        return user;
    if (typeof user === 'object') {
        const u = user;
        // ObjectId: `.id` alanı ham bayttır, string'e çevrilmez → önce toHexString
        if (typeof u.toHexString === 'function')
            return u.toHexString();
        const id = (_a = u._id) !== null && _a !== void 0 ? _a : u.id;
        if (id !== undefined && id !== null)
            return toCommandUserId(id);
        // Kimliksiz nesne: PII taşımamak için alanı düşür
        return undefined;
    }
    return String(user);
}
/**
 * Komut credential'larını aktarım için hazırlar. Girdiyi DEĞİŞTİRMEZ (outbox belgesi ya da
 * replay edilen kayıt yerinde bozulmasın diye kopya döner).
 */
function sealCommandCredentials(credentials) {
    if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials))
        return credentials;
    const result = Object.assign({}, credentials);
    if ('user' in result) {
        result.user = toCommandUserId(result.user);
    }
    if (!isCommandCredentialSealingEnabled())
        return result;
    for (const key of Object.keys(result)) {
        if (exports.COMMAND_CREDENTIAL_PLAIN_KEYS.has(key))
            continue;
        const value = result[key];
        if (typeof value === 'string' && value.length > 0 && !encryption_util_1.EncryptionUtil.isEncrypted(value)) {
            result[key] = encryption_util_1.EncryptionUtil.encrypt(value);
        }
    }
    return result;
}
/**
 * Mühürlü değerleri çözer (düz değerler aynen geçer). Çözülemeyen değer (ör. eski anahtarla
 * şifrelenmiş at-rest alan) setup'ı DÜŞÜRMEZ: anahtar adıyla `warn` loglanır ve yalnız o alan
 * düşürülür; öteki alanlar çalışır. Şifreli metin kimlik diye platform API'sine GİTMEZ
 * (yanlış-kimlik sayacı tetiklenmez); zorunlu alan düşerse platform doğrulaması hata verir.
 * Log yalnız anahtar adını içerir, değeri değil.
 */
function unsealCommandCredentials(credentials) {
    if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials))
        return credentials;
    let result = null;
    for (const key of Object.keys(credentials)) {
        const value = credentials[key];
        if (typeof value === 'string' && encryption_util_1.EncryptionUtil.isEncrypted(value)) {
            result = result !== null && result !== void 0 ? result : Object.assign({}, credentials);
            try {
                result[key] = encryption_util_1.EncryptionUtil.decrypt(value);
            }
            catch (err) {
                delete result[key];
                logger_service_1.logger.warn(`Command credential '${key}' could not be decrypted; field dropped`);
            }
        }
    }
    return (result !== null && result !== void 0 ? result : credentials);
}
/**
 * `integration:command` verisinin (`data`) iç `payload.credentials` alanını mühürler.
 * Kopya döner; `payload` ya da `credentials` yoksa aynı nesneyi döner.
 */
function sealIntegrationCommandData(data) {
    var _a;
    const credentials = (_a = data === null || data === void 0 ? void 0 : data.payload) === null || _a === void 0 ? void 0 : _a.credentials;
    if (!credentials || typeof credentials !== 'object')
        return data;
    return Object.assign(Object.assign({}, data), { payload: Object.assign(Object.assign({}, data.payload), { credentials: sealCommandCredentials(credentials) }) });
}
