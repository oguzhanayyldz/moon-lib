import mongoose from 'mongoose';
/**
 * UC-1056 — outbox ve deadletters saklama süresi (KVKK).
 *
 * Kopyalarda temizlenen kişisel veri outbox payload'ında ve DLQ `data` alanında süresiz kalıyordu. Süre ortam
 * değişkeniyle açılır; değişken yoksa hiçbir şey yapılmaz ('disabled'). Değişkeni kaldırmak kurulu indeksi
 * KALDIRMAZ — geri dönüş: `db.<koleksiyon>.dropIndex('<indeks adı>')`.
 *
 * Kısmi (partial) TTL: yalnız işi bitmiş durumlar silinir. Bekleyen/işlenen/yeniden denenecek kayıtlar kapsam dışı.
 */
export type RetentionTtlIndexResult = 'disabled' | 'unchanged' | 'modified' | 'created';
export declare const OUTBOX_RETENTION_TTL_INDEX = "outbox_retention_ttl";
/** pending/processing yayınlanmayı bekler; silinmez. failed için ayrı indeks: OUTBOX_FAILED_RETENTION_TTL_INDEX. */
export declare const OUTBOX_RETENTION_STATUSES: string[];
/**
 * UC-1210 — başarısız (failed) outbox kayıtları için AYRI indeks. `outbox_retention_ttl` indeksine failed eklemek
 * iki süreyi tek değişkene bağlardı (published 180 gün, failed 10 gün); ayrı indeks bağımsız ayarlanır. Aynı anahtar
 * ({creationDate:1}) + farklı partial filtre ile ikinci indeks, indeks adı farklı olduğu sürece Mongo'da kurulabilir.
 * Tarih alanı `creationDate`: her kayıtta vardır; `lastAttempt` hiç denenmemiş failed kayıtta boştur ve TTL boş
 * alanlı belgeyi asla silmez (KVKK sızıntısı). Yeniden denemeyle failed'a dönen kayıt yaşını creationDate'ten alır.
 */
export declare const OUTBOX_FAILED_RETENTION_TTL_INDEX = "outbox_failed_retention_ttl";
export declare const DEAD_LETTER_RETENTION_TTL_INDEX = "deadletter_retention_ttl";
/**
 * replaying/processing işlemci claim'idir (5 dk zaman aşımıyla queued'a döner), silinmez. pending yalnız DLQ-H öncesi
 * kalıntıdır; archived (UC-1044 onarımı) ve queued (en çok 5 oynatmada ~31 dk içinde çıkar; 30+ günlük kayıt bayattır)
 * saklama süresi dolunca silinir.
 */
export declare const DEAD_LETTER_RETENTION_STATUSES: string[];
/**
 * Gün sayısını okur. Tanımsız/boş → undefined (kapalı). Pozitif tam sayı değilse hata atar: yanlış yazılmış
 * değer sessizce "kapalı" sayılmasın, başlangıçta uyarı olarak loglansın.
 */
export declare function parseRetentionDays(raw: string | undefined, variableName: string): number | undefined;
/** OUTBOX_RETENTION_DAYS: yayınlanmış outbox kayıtları `creationDate`'ten bu kadar gün sonra silinir. */
export declare function ensureOutboxRetentionTtlIndex(connection: mongoose.Connection, days?: number | undefined): Promise<RetentionTtlIndexResult>;
/** OUTBOX_FAILED_RETENTION_DAYS: failed outbox kayıtları `creationDate`'ten bu kadar gün sonra silinir. */
export declare function ensureOutboxFailedRetentionTtlIndex(connection: mongoose.Connection, days?: number | undefined): Promise<RetentionTtlIndexResult>;
/** DEADLETTER_RETENTION_DAYS: biten/oynatılamaz DLQ kayıtları `timestamp`'ten bu kadar gün sonra silinir. */
export declare function ensureDeadLetterRetentionTtlIndex(connection: mongoose.Connection, days?: number | undefined): Promise<RetentionTtlIndexResult>;
/** Başlangıcı bekletmez; hata servisi durdurmaz (UC-962 deseni). */
export declare function ensureRetentionTtlIndexes(connection: mongoose.Connection, log: {
    info: (message: string) => void;
    warn: (message: string, meta?: unknown) => void;
}): void;
