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
export declare const SEAL_COMMAND_CREDENTIALS_ENV = "SEAL_INTEGRATION_COMMAND_CREDENTIALS";
/** Mühürlenmeyen, yönlendirme/kimlik amaçlı anahtarlar (gizli değil, düz kalmalı). */
export declare const COMMAND_CREDENTIAL_PLAIN_KEYS: ReadonlySet<string>;
export declare function isCommandCredentialSealingEnabled(): boolean;
/** Tam User belgesi / { id } / ObjectId → yalnız kimlik string'i. String ise aynen döner. */
export declare function toCommandUserId(user: unknown): unknown;
/**
 * Komut credential'larını aktarım için hazırlar. Girdiyi DEĞİŞTİRMEZ (outbox belgesi ya da
 * replay edilen kayıt yerinde bozulmasın diye kopya döner).
 */
export declare function sealCommandCredentials<T extends Record<string, any> | null | undefined>(credentials: T): T;
/**
 * Mühürlü değerleri çözer (düz değerler aynen geçer). Çözülemeyen değerde HATA fırlatır:
 * şifreli metni platform API'sine kimlik diye göndermek yanlış-kimlik sayacını tetikler.
 * Hata mesajı yalnız anahtar adını içerir, değeri değil.
 */
export declare function unsealCommandCredentials<T extends Record<string, any> | null | undefined>(credentials: T): T;
/**
 * `integration:command` verisinin (`data`) iç `payload.credentials` alanını mühürler.
 * Kopya döner; `payload` ya da `credentials` yoksa aynı nesneyi döner.
 */
export declare function sealIntegrationCommandData<T extends Record<string, any> | null | undefined>(data: T): T;
//# sourceMappingURL=commandCredentials.util.d.ts.map