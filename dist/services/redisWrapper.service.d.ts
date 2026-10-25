import { RedisClientType } from 'redis';
/**
 * Açılışta Redis'e ulaşılamazsa connect()'in toplam kaç ms yeniden deneyeceği (UC-1043).
 * REDIS_STARTUP_MAX_WAIT_MS yoksa ya da geçersizse -1 = süresiz (tavan startup probe'dadır);
 * 0 = tek deneme (eski davranış).
 */
export declare function resolveRedisStartupMaxWaitMs(): number;
/** n. başarısız açılış denemesinden sonraki bekleme: 1, 2, 4, 8, 16, 30, 30 ... sn. */
export declare function getRedisStartupRetryDelay(attempt: number): number;
declare class RedisWrapper {
    private static instances;
    private _client?;
    private _url?;
    private hasConnected;
    get client(): RedisClientType;
    /**
     * Redis'e bağlanır. Açılışta (bu süreç henüz hiç bağlanmadıysa) Redis geç gelirse tavanlı üstel geri çekilmeyle
     * yeniden dener (UC-1043): CI Redis'i ve servisleri birlikte yeniden başlattığında servis Redis'ten önce açılıp
     * tek denemede vazgeçiyor, start()'ın catch'i hatayı yutunca HTTP sunucusu hiç açılmıyor ve pod startup probe
     * dolana kadar (~5 dk) hizmet dışı kalıyordu. Bekleme süresince HTTP kapalı olduğundan pod hazır sayılmaz.
     * Çalışma sırasındaki yeniden bağlanma (servislerin 'end' işleyicisi) tek deneme kalır: başarısızlıkta servis
     * yeniden başlar; aksi halde eski istemciyi tutan bileşenler kapalı istemciyle kalırdı.
     * Kod/yapılandırma hatası (geçersiz URL: TypeError) yeniden denenmez.
     */
    connect(url: string, timeoutMs?: number): Promise<void>;
    private connectOnce;
    deleteOrder(userId: string, purchaseNumber: string, platformNumber: string): Promise<boolean>;
    setOrder(userId: string, purchaseNumber: string, platformNumber: string, orderData: object): Promise<void>;
    getOrder(userId: string, purchaseNumber: string, platformNumber: string): Promise<{
        [x: string]: string;
    } | null>;
    updateOrderStatus(userId: string, purchaseNumber: string, platformNumber: string, status: string): Promise<void>;
    deleteCredentials(userId: string, platform: string): Promise<void>;
    setCredentials(userId: string, platform: string, credentials: object): Promise<void>;
    getCredentials(userId: string, platform: string): Promise<{
        [x: string]: string;
    } | null>;
    updateCredentials(userId: string, platform: string, credentials: any): Promise<void>;
    eval(script: string, params: {
        keys: string[];
        arguments: string[];
    }): Promise<any>;
    setNX(key: string, value: string, expireSeconds: number): Promise<boolean>;
    /**
     * Objeyi Redis hash field'larına dönüştürür — double serialization olmadan.
     * undefined/null değerleri atlar, nested objeleri JSON.stringify ile serialize eder.
     */
    private toHashFields;
    disconnect(): Promise<void>;
    getConnectionStats(): {
        totalInstances: number;
        currentUrl: string | undefined;
        isConnected: boolean;
    };
    getActiveConnections(): number;
    static getInstanceUrls(): string[];
}
export declare const redisWrapper: RedisWrapper;
export {};
