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

export const OUTBOX_RETENTION_TTL_INDEX = 'outbox_retention_ttl';
/** pending/processing yayınlanmayı bekler; silinmez. failed için ayrı indeks: OUTBOX_FAILED_RETENTION_TTL_INDEX. */
export const OUTBOX_RETENTION_STATUSES = ['published', 'completed', 'superseded'];

/**
 * UC-1210 — başarısız (failed) outbox kayıtları için AYRI indeks. `outbox_retention_ttl` indeksine failed eklemek
 * iki süreyi tek değişkene bağlardı (published 180 gün, failed 10 gün); ayrı indeks bağımsız ayarlanır. Aynı anahtar
 * ({creationDate:1}) + farklı partial filtre ile ikinci indeks, indeks adı farklı olduğu sürece Mongo'da kurulabilir.
 * Tarih alanı `creationDate`: her kayıtta vardır; `lastAttempt` hiç denenmemiş failed kayıtta boştur ve TTL boş
 * alanlı belgeyi asla silmez (KVKK sızıntısı). Yeniden denemeyle failed'a dönen kayıt yaşını creationDate'ten alır.
 */
export const OUTBOX_FAILED_RETENTION_TTL_INDEX = 'outbox_failed_retention_ttl';

export const DEAD_LETTER_RETENTION_TTL_INDEX = 'deadletter_retention_ttl';
/**
 * replaying/processing işlemci claim'idir (5 dk zaman aşımıyla queued'a döner), silinmez. pending yalnız DLQ-H öncesi
 * kalıntıdır; archived (UC-1044 onarımı) ve queued (en çok 5 oynatmada ~31 dk içinde çıkar; 30+ günlük kayıt bayattır)
 * saklama süresi dolunca silinir.
 */
export const DEAD_LETTER_RETENTION_STATUSES = ['completed', 'failed', 'pending', 'archived', 'queued'];

/**
 * Gün sayısını okur. Tanımsız/boş → undefined (kapalı). Pozitif tam sayı değilse hata atar: yanlış yazılmış
 * değer sessizce "kapalı" sayılmasın, başlangıçta uyarı olarak loglansın.
 */
export function parseRetentionDays(raw: string | undefined, variableName: string): number | undefined {
    if (raw === undefined || raw.trim() === '') return undefined;
    // Number() '1e2', '0x1E', '30.0', '+30' gibi yazımları da kabul eder: yalnız düz rakam dizisi geçerli
    const days = /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
    if (!Number.isInteger(days) || days < 1) {
        throw new Error(`${variableName} must be a positive integer (days), got "${raw}"`);
    }
    return days;
}

async function ensureRetentionTtlIndex(
    connection: mongoose.Connection,
    modelName: string,
    indexName: string,
    dateField: string,
    partialFilterExpression: Record<string, unknown>,
    days: number | undefined
): Promise<RetentionTtlIndexResult> {
    if (days === undefined) return 'disabled';

    const expireAfterSeconds = days * 24 * 60 * 60;
    const collection = connection.model(modelName).collection;

    let indexes: Array<{
        name?: string;
        key: Record<string, unknown>;
        expireAfterSeconds?: number;
        partialFilterExpression?: unknown;
    }> = [];
    try {
        indexes = (await collection.indexes()) as typeof indexes;
    } catch (error: any) {
        // Koleksiyon henüz yok (ilk kurulum): NamespaceNotFound
        if (error?.code !== 26) throw error;
    }

    const existing = indexes.find(index => index.name === indexName);
    if (existing) {
        const sameShape =
            JSON.stringify(existing.key) === JSON.stringify({ [dateField]: 1 }) &&
            JSON.stringify(existing.partialFilterExpression) === JSON.stringify(partialFilterExpression);
        if (sameShape) {
            if (existing.expireAfterSeconds === expireAfterSeconds) return 'unchanged';
            await connection.db.command({
                collMod: collection.collectionName,
                index: { name: indexName, expireAfterSeconds }
            });
            return 'modified';
        }
        // Kısmi filtre collMod ile değiştirilemez: indeksi yeniden kur
        try {
            await collection.dropIndex(indexName);
        } catch (error: any) {
            // Eşzamanlı başlayan başka pod aynı indeksi çoktan düşürdü: IndexNotFound, create ile devam
            if (error?.code !== 27) throw error;
        }
        await collection.createIndex({ [dateField]: 1 }, { name: indexName, expireAfterSeconds, partialFilterExpression });
        return 'modified';
    }

    await collection.createIndex({ [dateField]: 1 }, { name: indexName, expireAfterSeconds, partialFilterExpression });
    return 'created';
}

/** OUTBOX_RETENTION_DAYS: yayınlanmış outbox kayıtları `creationDate`'ten bu kadar gün sonra silinir. */
export function ensureOutboxRetentionTtlIndex(
    connection: mongoose.Connection,
    days: number | undefined = parseRetentionDays(process.env.OUTBOX_RETENTION_DAYS, 'OUTBOX_RETENTION_DAYS')
): Promise<RetentionTtlIndexResult> {
    return ensureRetentionTtlIndex(
        connection, 'Outbox', OUTBOX_RETENTION_TTL_INDEX, 'creationDate',
        { status: { $in: OUTBOX_RETENTION_STATUSES } }, days
    );
}

/** OUTBOX_FAILED_RETENTION_DAYS: failed outbox kayıtları `creationDate`'ten bu kadar gün sonra silinir. */
export function ensureOutboxFailedRetentionTtlIndex(
    connection: mongoose.Connection,
    days: number | undefined = parseRetentionDays(process.env.OUTBOX_FAILED_RETENTION_DAYS, 'OUTBOX_FAILED_RETENTION_DAYS')
): Promise<RetentionTtlIndexResult> {
    return ensureRetentionTtlIndex(
        connection, 'Outbox', OUTBOX_FAILED_RETENTION_TTL_INDEX, 'creationDate', { status: 'failed' }, days
    );
}

/** DEADLETTER_RETENTION_DAYS: biten/oynatılamaz DLQ kayıtları `timestamp`'ten bu kadar gün sonra silinir. */
export function ensureDeadLetterRetentionTtlIndex(
    connection: mongoose.Connection,
    days: number | undefined = parseRetentionDays(process.env.DEADLETTER_RETENTION_DAYS, 'DEADLETTER_RETENTION_DAYS')
): Promise<RetentionTtlIndexResult> {
    return ensureRetentionTtlIndex(
        connection, 'DeadLetter', DEAD_LETTER_RETENTION_TTL_INDEX, 'timestamp',
        { status: { $in: DEAD_LETTER_RETENTION_STATUSES } }, days
    );
}

/** Başlangıcı bekletmez; hata servisi durdurmaz (UC-962 deseni). */
export function ensureRetentionTtlIndexes(
    connection: mongoose.Connection,
    log: { info: (message: string) => void; warn: (message: string, meta?: unknown) => void }
): void {
    const run = (label: string, ensure: () => Promise<RetentionTtlIndexResult>) => {
        Promise.resolve()
            .then(ensure)
            .then(result => log.info(`${label} retention TTL index: ${result}`))
            .catch(error => log.warn(`${label} retention TTL index could not be ensured`, {
                error: (error as Error)?.message
            }));
    };
    run('Outbox', () => ensureOutboxRetentionTtlIndex(connection));
    run('OutboxFailed', () => ensureOutboxFailedRetentionTtlIndex(connection));
    run('DeadLetter', () => ensureDeadLetterRetentionTtlIndex(connection));
}
