import { envScopedKey } from './redisEnvScope.util';

/**
 * UC-984 madde 9 — sürüm olayı iletim kirası ve "gönderilmiş en son sürüm" indeksi (Redis).
 *
 * İLKE: kalıcı gerçek kaynak Mongo outbox'tır. Redis yalnız iki işaret tutar:
 *  - `vsync:inflight:<service>:<entityType>:<entityId>` = `<version>:<podId>:<batchId>` (SET NX PX):
 *    varlığın bir sürümü şu an bir partide iletimde. Kirayı alamayan parti o varlığı bu turda göndermez,
 *    satırı pending'e geri bırakır (sonraki turda gider). Pod ölürse kira PX sonunda kendiliğinden düşer.
 *  - `vsync:latest:<service>:<entityType>:<entityId>` = NATS'e GÖNDERİLMİŞ en yüksek sürüm (yalnız büyürse yazılır).
 *    Sürümü bundan büyük olmayan satır gönderilmez, 'superseded' olur (sync o sürümü ya da daha yenisini zaten aldı).
 *
 * NEDEN "gönderilmiş" sürüm, "yazılmış" değil: yazım anında Redis'e yazılırsa, ardından geri alınan bir Mongo
 * işlemi (transaction abort) Redis'te hiç var olmamış bir sürüm bırakır ve gerçek eski satır yanlışlıkla
 * 'superseded' olur — kayıp. Gönderim sonrası yazılan değer yalnız gerçekten yayınlanmış bir sürümü gösterir;
 * Redis boşalırsa ya da değer düşerse en kötü sonuç zararsız tekrar gönderimdir.
 *
 * Her iki betik partideki tüm varlıkları TEK ağ turunda işler (satır başına tur yok — ölçek hedefi, madde 0).
 * Anahtarlar tek Redis örneği varsayar (Moon: tek düğüm); Redis Cluster'da hash-tag gerekir.
 * Redis dev ve prod arasında paylaşımlı olduğu için anahtarlar envScopedKey ile ortama göre ayrılır.
 */

/** node-redis v4 `client.eval(script, { keys, arguments })` imzasının kullanılan kısmı */
export interface VersionLeaseRedis {
    eval(script: string, options: { keys: string[]; arguments: string[] }): Promise<unknown>;
}

export interface VersionLeaseEntity {
    entityType: string;
    entityId: string;
    service: string;
    version: number;
}

/** acquired: kira alındı, gönder · inflight: başka parti iletiyor, bırak · delivered: bu sürüm ya da yenisi gönderildi */
export type VersionLeaseDecision = 'acquired' | 'inflight' | 'delivered';

const ACQUIRE_SCRIPT = `
local n = #KEYS / 2
local out = {}
for i = 1, n do
    local version = tonumber(ARGV[2 + i])
    local latest = tonumber(redis.call('GET', KEYS[2 * i]))
    if latest and version <= latest then
        out[i] = 2
    elseif redis.call('SET', KEYS[2 * i - 1], ARGV[2 + i] .. ':' .. ARGV[1], 'NX', 'PX', ARGV[2]) then
        out[i] = 1
    else
        out[i] = 0
    end
end
return out`;

const MARK_DELIVERED_SCRIPT = `
local n = #KEYS
for i = 1, n do
    local version = tonumber(ARGV[1 + i])
    local latest = tonumber(redis.call('GET', KEYS[i]))
    if not latest or version > latest then
        redis.call('SET', KEYS[i], ARGV[1 + i], 'PX', ARGV[1])
    else
        redis.call('PEXPIRE', KEYS[i], ARGV[1])
    end
end
return n`;

/** Yalnız sahibinin kirasını siler (RetryableListener compare-and-delete deseni); dönen değer: süresi dolmuş/el değiştirmiş kira sayısı */
const RELEASE_SCRIPT = `
local expired = 0
for i = 1, #KEYS do
    if redis.call('GET', KEYS[i]) == ARGV[1 + i] .. ':' .. ARGV[1] then
        redis.call('DEL', KEYS[i])
    else
        expired = expired + 1
    end
end
return expired`;

const DECISIONS: Record<number, VersionLeaseDecision> = { 0: 'inflight', 1: 'acquired', 2: 'delivered' };

export function versionInflightKey(entity: VersionLeaseEntity): string {
    return envScopedKey(`vsync:inflight:${entity.service}:${entity.entityType}:${entity.entityId}`);
}

export function versionLatestKey(entity: VersionLeaseEntity): string {
    return envScopedKey(`vsync:latest:${entity.service}:${entity.entityType}:${entity.entityId}`);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Redis lease call timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export interface VersionEventLeaseOptions {
    leaseMs: number;
    latestTtlMs: number;
    timeoutMs: number;
}

/**
 * Hata/zaman aşımı yukarı atılır; çağıran (EventPublisherJob) Redis'siz Mongo claim'iyle devam eder.
 * İstemci her çağrıda yeniden alınır: bağlantı sonradan kurulursa ya da koparsa kendiliğinden izlenir.
 */
export class VersionEventLeases {
    constructor(
        private readonly getRedis: () => VersionLeaseRedis,
        private readonly options: VersionEventLeaseOptions
    ) {}

    async acquire(entities: VersionLeaseEntity[], token: string): Promise<VersionLeaseDecision[]> {
        if (entities.length === 0) return [];
        const keys = entities.flatMap(e => [versionInflightKey(e), versionLatestKey(e)]);
        const args = [token, String(this.options.leaseMs), ...entities.map(e => String(e.version))];
        const raw = await withTimeout(this.getRedis().eval(ACQUIRE_SCRIPT, { keys, arguments: args }), this.options.timeoutMs);
        if (!Array.isArray(raw) || raw.length !== entities.length) {
            throw new Error('Unexpected Redis lease acquire reply');
        }
        return raw.map(code => {
            const decision = DECISIONS[Number(code)];
            if (!decision) throw new Error('Unexpected Redis lease acquire reply');
            return decision;
        });
    }

    async markDelivered(entities: VersionLeaseEntity[]): Promise<void> {
        if (entities.length === 0) return;
        const keys = entities.map(versionLatestKey);
        const args = [String(this.options.latestTtlMs), ...entities.map(e => String(e.version))];
        await withTimeout(this.getRedis().eval(MARK_DELIVERED_SCRIPT, { keys, arguments: args }), this.options.timeoutMs);
    }

    /** @returns kira bırakılırken artık bu sahibin olmayan (süresi dolmuş) kira sayısı */
    async release(entities: VersionLeaseEntity[], token: string): Promise<number> {
        if (entities.length === 0) return 0;
        const keys = entities.map(versionInflightKey);
        const args = [token, ...entities.map(e => String(e.version))];
        const expired = await withTimeout(this.getRedis().eval(RELEASE_SCRIPT, { keys, arguments: args }), this.options.timeoutMs);
        return Number(expired) || 0;
    }
}
