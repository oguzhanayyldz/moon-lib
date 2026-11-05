import { EncryptionUtil } from './encryption.util';

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

export const SEAL_COMMAND_CREDENTIALS_ENV = 'SEAL_INTEGRATION_COMMAND_CREDENTIALS';

/** Mühürlenmeyen, yönlendirme/kimlik amaçlı anahtarlar (gizli değil, düz kalmalı). */
export const COMMAND_CREDENTIAL_PLAIN_KEYS: ReadonlySet<string> = new Set([
    'user',
    'platform',
    'integration_active',
    'integrationId'
]);

export function isCommandCredentialSealingEnabled(): boolean {
    return process.env[SEAL_COMMAND_CREDENTIALS_ENV] === 'true' && !!process.env.ENCRYPTION_KEY;
}

/** Tam User belgesi / { id } / ObjectId → yalnız kimlik string'i. String ise aynen döner. */
export function toCommandUserId(user: unknown): unknown {
    if (user === null || user === undefined || typeof user === 'string') return user;
    if (typeof user === 'object') {
        const u = user as Record<string, any>;
        // ObjectId: `.id` alanı ham bayttır, string'e çevrilmez → önce toHexString
        if (typeof u.toHexString === 'function') return u.toHexString();
        const id = u._id ?? u.id;
        if (id !== undefined && id !== null) return toCommandUserId(id);
        // Kimliksiz nesne: PII taşımamak için alanı düşür
        return undefined;
    }
    return String(user);
}

/**
 * Komut credential'larını aktarım için hazırlar. Girdiyi DEĞİŞTİRMEZ (outbox belgesi ya da
 * replay edilen kayıt yerinde bozulmasın diye kopya döner).
 */
export function sealCommandCredentials<T extends Record<string, any> | null | undefined>(credentials: T): T {
    if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) return credentials;

    const result: Record<string, any> = { ...credentials };
    if ('user' in result) {
        result.user = toCommandUserId(result.user);
    }

    if (!isCommandCredentialSealingEnabled()) return result as T;

    for (const key of Object.keys(result)) {
        if (COMMAND_CREDENTIAL_PLAIN_KEYS.has(key)) continue;
        const value = result[key];
        if (typeof value === 'string' && value.length > 0 && !EncryptionUtil.isEncrypted(value)) {
            result[key] = EncryptionUtil.encrypt(value);
        }
    }
    return result as T;
}

/**
 * Mühürlü değerleri çözer (düz değerler aynen geçer). Çözülemeyen değerde HATA fırlatır:
 * şifreli metni platform API'sine kimlik diye göndermek yanlış-kimlik sayacını tetikler.
 * Hata mesajı yalnız anahtar adını içerir, değeri değil.
 */
export function unsealCommandCredentials<T extends Record<string, any> | null | undefined>(credentials: T): T {
    if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) return credentials;

    let result: Record<string, any> | null = null;
    for (const key of Object.keys(credentials)) {
        const value = (credentials as Record<string, any>)[key];
        if (typeof value === 'string' && EncryptionUtil.isEncrypted(value)) {
            result = result ?? { ...credentials };
            try {
                result[key] = EncryptionUtil.decrypt(value);
            } catch (err) {
                throw new Error(
                    `Command credential '${key}' could not be decrypted: ${err instanceof Error ? err.message : 'unknown'}`
                );
            }
        }
    }
    return (result ?? credentials) as T;
}

/**
 * `integration:command` verisinin (`data`) iç `payload.credentials` alanını mühürler.
 * Kopya döner; `payload` ya da `credentials` yoksa aynı nesneyi döner.
 */
export function sealIntegrationCommandData<T extends Record<string, any> | null | undefined>(data: T): T {
    const credentials = data?.payload?.credentials;
    if (!credentials || typeof credentials !== 'object') return data;
    return {
        ...(data as any),
        payload: { ...(data as any).payload, credentials: sealCommandCredentials(credentials) }
    } as T;
}
