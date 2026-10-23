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
    eval(script: string, options: {
        keys: string[];
        arguments: string[];
    }): Promise<unknown>;
}
export interface VersionLeaseEntity {
    entityType: string;
    entityId: string;
    service: string;
    version: number;
}
/** acquired: kira alındı, gönder · inflight: başka parti iletiyor, bırak · delivered: bu sürüm ya da yenisi gönderildi */
export type VersionLeaseDecision = 'acquired' | 'inflight' | 'delivered';
export declare function versionInflightKey(entity: VersionLeaseEntity): string;
export declare function versionLatestKey(entity: VersionLeaseEntity): string;
export interface VersionEventLeaseOptions {
    leaseMs: number;
    latestTtlMs: number;
    timeoutMs: number;
}
/**
 * Hata/zaman aşımı yukarı atılır; çağıran (EventPublisherJob) Redis'siz Mongo claim'iyle devam eder.
 * İstemci her çağrıda yeniden alınır: bağlantı sonradan kurulursa ya da koparsa kendiliğinden izlenir.
 */
export declare class VersionEventLeases {
    private readonly getRedis;
    private readonly options;
    constructor(getRedis: () => VersionLeaseRedis, options: VersionEventLeaseOptions);
    acquire(entities: VersionLeaseEntity[], token: string): Promise<VersionLeaseDecision[]>;
    markDelivered(entities: VersionLeaseEntity[]): Promise<void>;
    /** @returns kira bırakılırken artık bu sahibin olmayan (süresi dolmuş) kira sayısı */
    release(entities: VersionLeaseEntity[], token: string): Promise<number>;
}
//# sourceMappingURL=versionEventLease.util.d.ts.map