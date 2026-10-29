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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEAD_LETTER_RETENTION_STATUSES = exports.DEAD_LETTER_RETENTION_TTL_INDEX = exports.OUTBOX_FAILED_RETENTION_TTL_INDEX = exports.OUTBOX_RETENTION_STATUSES = exports.OUTBOX_RETENTION_TTL_INDEX = void 0;
exports.parseRetentionDays = parseRetentionDays;
exports.ensureOutboxRetentionTtlIndex = ensureOutboxRetentionTtlIndex;
exports.ensureOutboxFailedRetentionTtlIndex = ensureOutboxFailedRetentionTtlIndex;
exports.ensureDeadLetterRetentionTtlIndex = ensureDeadLetterRetentionTtlIndex;
exports.ensureRetentionTtlIndexes = ensureRetentionTtlIndexes;
exports.OUTBOX_RETENTION_TTL_INDEX = 'outbox_retention_ttl';
/** pending/processing yayınlanmayı bekler; silinmez. failed için ayrı indeks: OUTBOX_FAILED_RETENTION_TTL_INDEX. */
exports.OUTBOX_RETENTION_STATUSES = ['published', 'completed', 'superseded'];
/**
 * UC-1210 — başarısız (failed) outbox kayıtları için AYRI indeks. `outbox_retention_ttl` indeksine failed eklemek
 * iki süreyi tek değişkene bağlardı (published 180 gün, failed 10 gün); ayrı indeks bağımsız ayarlanır. Aynı anahtar
 * ({creationDate:1}) + farklı partial filtre ile ikinci indeks, indeks adı farklı olduğu sürece Mongo'da kurulabilir.
 * Tarih alanı `creationDate`: her kayıtta vardır; `lastAttempt` hiç denenmemiş failed kayıtta boştur ve TTL boş
 * alanlı belgeyi asla silmez (KVKK sızıntısı). Yeniden denemeyle failed'a dönen kayıt yaşını creationDate'ten alır.
 */
exports.OUTBOX_FAILED_RETENTION_TTL_INDEX = 'outbox_failed_retention_ttl';
exports.DEAD_LETTER_RETENTION_TTL_INDEX = 'deadletter_retention_ttl';
/**
 * replaying/processing işlemci claim'idir (5 dk zaman aşımıyla queued'a döner), silinmez. pending yalnız DLQ-H öncesi
 * kalıntıdır; archived (UC-1044 onarımı) ve queued (en çok 5 oynatmada ~31 dk içinde çıkar; 30+ günlük kayıt bayattır)
 * saklama süresi dolunca silinir.
 */
exports.DEAD_LETTER_RETENTION_STATUSES = ['completed', 'failed', 'pending', 'archived', 'queued'];
/**
 * Gün sayısını okur. Tanımsız/boş → undefined (kapalı). Pozitif tam sayı değilse hata atar: yanlış yazılmış
 * değer sessizce "kapalı" sayılmasın, başlangıçta uyarı olarak loglansın.
 */
function parseRetentionDays(raw, variableName) {
    if (raw === undefined || raw.trim() === '')
        return undefined;
    // Number() '1e2', '0x1E', '30.0', '+30' gibi yazımları da kabul eder: yalnız düz rakam dizisi geçerli
    const days = /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
    if (!Number.isInteger(days) || days < 1) {
        throw new Error(`${variableName} must be a positive integer (days), got "${raw}"`);
    }
    return days;
}
function ensureRetentionTtlIndex(connection, modelName, indexName, dateField, partialFilterExpression, days) {
    return __awaiter(this, void 0, void 0, function* () {
        if (days === undefined)
            return 'disabled';
        const expireAfterSeconds = days * 24 * 60 * 60;
        const collection = connection.model(modelName).collection;
        let indexes = [];
        try {
            indexes = (yield collection.indexes());
        }
        catch (error) {
            // Koleksiyon henüz yok (ilk kurulum): NamespaceNotFound
            if ((error === null || error === void 0 ? void 0 : error.code) !== 26)
                throw error;
        }
        const existing = indexes.find(index => index.name === indexName);
        if (existing) {
            const sameShape = JSON.stringify(existing.key) === JSON.stringify({ [dateField]: 1 }) &&
                JSON.stringify(existing.partialFilterExpression) === JSON.stringify(partialFilterExpression);
            if (sameShape) {
                if (existing.expireAfterSeconds === expireAfterSeconds)
                    return 'unchanged';
                yield connection.db.command({
                    collMod: collection.collectionName,
                    index: { name: indexName, expireAfterSeconds }
                });
                return 'modified';
            }
            // Kısmi filtre collMod ile değiştirilemez: indeksi yeniden kur
            try {
                yield collection.dropIndex(indexName);
            }
            catch (error) {
                // Eşzamanlı başlayan başka pod aynı indeksi çoktan düşürdü: IndexNotFound, create ile devam
                if ((error === null || error === void 0 ? void 0 : error.code) !== 27)
                    throw error;
            }
            yield collection.createIndex({ [dateField]: 1 }, { name: indexName, expireAfterSeconds, partialFilterExpression });
            return 'modified';
        }
        yield collection.createIndex({ [dateField]: 1 }, { name: indexName, expireAfterSeconds, partialFilterExpression });
        return 'created';
    });
}
/** OUTBOX_RETENTION_DAYS: yayınlanmış outbox kayıtları `creationDate`'ten bu kadar gün sonra silinir. */
function ensureOutboxRetentionTtlIndex(connection, days = parseRetentionDays(process.env.OUTBOX_RETENTION_DAYS, 'OUTBOX_RETENTION_DAYS')) {
    return ensureRetentionTtlIndex(connection, 'Outbox', exports.OUTBOX_RETENTION_TTL_INDEX, 'creationDate', { status: { $in: exports.OUTBOX_RETENTION_STATUSES } }, days);
}
/** OUTBOX_FAILED_RETENTION_DAYS: failed outbox kayıtları `creationDate`'ten bu kadar gün sonra silinir. */
function ensureOutboxFailedRetentionTtlIndex(connection, days = parseRetentionDays(process.env.OUTBOX_FAILED_RETENTION_DAYS, 'OUTBOX_FAILED_RETENTION_DAYS')) {
    return ensureRetentionTtlIndex(connection, 'Outbox', exports.OUTBOX_FAILED_RETENTION_TTL_INDEX, 'creationDate', { status: 'failed' }, days);
}
/** DEADLETTER_RETENTION_DAYS: biten/oynatılamaz DLQ kayıtları `timestamp`'ten bu kadar gün sonra silinir. */
function ensureDeadLetterRetentionTtlIndex(connection, days = parseRetentionDays(process.env.DEADLETTER_RETENTION_DAYS, 'DEADLETTER_RETENTION_DAYS')) {
    return ensureRetentionTtlIndex(connection, 'DeadLetter', exports.DEAD_LETTER_RETENTION_TTL_INDEX, 'timestamp', { status: { $in: exports.DEAD_LETTER_RETENTION_STATUSES } }, days);
}
/** Başlangıcı bekletmez; hata servisi durdurmaz (UC-962 deseni). */
function ensureRetentionTtlIndexes(connection, log) {
    const run = (label, ensure) => {
        Promise.resolve()
            .then(ensure)
            .then(result => log.info(`${label} retention TTL index: ${result}`))
            .catch(error => log.warn(`${label} retention TTL index could not be ensured`, {
            error: error === null || error === void 0 ? void 0 : error.message
        }));
    };
    run('Outbox', () => ensureOutboxRetentionTtlIndex(connection));
    run('OutboxFailed', () => ensureOutboxFailedRetentionTtlIndex(connection));
    run('DeadLetter', () => ensureDeadLetterRetentionTtlIndex(connection));
}
