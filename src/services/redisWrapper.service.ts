import { createClient, RedisClientType } from 'redis';
import { logger } from './logger.service';
import { maskConnectionUriSecret, sanitizeConnectionError, toSafeError } from '../utils/logSafety.util';
import { parseRedisConnectionUrl } from '../utils/redisConnection.util';

const STARTUP_RETRY_BASE_DELAY_MS = 1000;
const STARTUP_RETRY_MAX_DELAY_MS = 30000;

/**
 * Açılışta Redis'e ulaşılamazsa connect()'in toplam kaç ms yeniden deneyeceği (UC-1043).
 * REDIS_STARTUP_MAX_WAIT_MS yoksa ya da geçersizse -1 = süresiz (tavan startup probe'dadır);
 * 0 = tek deneme (eski davranış).
 */
export function resolveRedisStartupMaxWaitMs(): number {
    const raw = process.env.REDIS_STARTUP_MAX_WAIT_MS;
    if (raw === undefined || raw.trim() === '') return -1;
    const value = Number(raw);
    return Number.isInteger(value) && value >= 0 ? value : -1;
}

/** n. başarısız açılış denemesinden sonraki bekleme: 1, 2, 4, 8, 16, 30, 30 ... sn. */
export function getRedisStartupRetryDelay(attempt: number): number {
    return Math.min(STARTUP_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1), STARTUP_RETRY_MAX_DELAY_MS);
}

/** Bu denemeden sonra yeniden bağlanma logu warn'a yükselir (vazgeçilmez; UC-2494). */
const RECONNECT_WARN_AFTER_RETRIES = 10;
const RECONNECT_MAX_DELAY_MS = 10000;

/**
 * Çalışma sırasında kopan bağlantı için n. yeniden bağlanma denemesinden önceki bekleme: 1, 2, 4, 8, 10, 10 ... sn.
 * Her zaman sayı döner (UC-2494): Error/false dönmek istemciyi kalıcı kapatır. Tavan 10 sn: Redis geri gelince
 * istemci en geç ~10 sn'de toparlanır.
 */
export function getRedisReconnectDelay(retries: number): number {
    return Math.min(Math.pow(2, Math.max(0, retries)) * 1000, RECONNECT_MAX_DELAY_MS);
}

class RedisWrapper {
    private static instances: Map<string, RedisClientType> = new Map();
    private _client?: RedisClientType;
    private _url?: string;
    private hasConnected = false;
    private reopening?: Promise<void>;
    private endedClients = new WeakSet<RedisClientType>();

    get client() {
        if (!this._client) {
            throw new Error('Cannot access Redis client before connecting');
        }
        if (!this._client.isOpen) {
            // UC-2494: kapalı kalmış istemciyi aynı nesne üzerinden yeniden aç. connect() isOpen'ı eşzamanlı
            // true yaptığından bu çağrının komutu çevrimdışı kuyrukta bekler, bağlantı gelince çalışır.
            void this.reopenClosedClient();
        }
        return this._client;
    }

    /**
     * UC-2494: 'end' yaymadan kapanmış (isOpen=false) istemciyi AYNI nesne üzerinden yeniden açar. Aynı nesne
     * önemlidir: RateLimiter, güvenlik servisi gibi bileşenler istemci referansını açılışta saklar; yeni istemci
     * kurulsaydı onlar kapalı istemcide kalırdı. Tek uçuş: eşzamanlı çağrılar aynı söze bağlanır, connect() bir
     * kez çağrılır. Bilinçli kapatılmış (quit/disconnect → 'end') istemciye dokunmaz.
     */
    reopenClosedClient(): Promise<void> {
        const client = this._client;
        if (this.reopening) return this.reopening;
        if (!client || client.isOpen || this.endedClients.has(client)) return Promise.resolve();

        logger.warn('🔄 Redis client is closed (reconnect gave up); reopening the same client');
        const reopening: Promise<void> = client.connect()
            .then(() => { logger.info('✅ Redis client reopened'); })
            .catch((err) => { logger.error('❌ Redis client reopen failed:', sanitizeConnectionError(err)); })
            .finally(() => { this.reopening = undefined; });
        this.reopening = reopening;
        return reopening;
    }

    /**
     * Redis'e bağlanır. Açılışta (bu süreç henüz hiç bağlanmadıysa) Redis geç gelirse tavanlı üstel geri çekilmeyle
     * yeniden dener (UC-1043): CI Redis'i ve servisleri birlikte yeniden başlattığında servis Redis'ten önce açılıp
     * tek denemede vazgeçiyor, start()'ın catch'i hatayı yutunca HTTP sunucusu hiç açılmıyor ve pod startup probe
     * dolana kadar (~5 dk) hizmet dışı kalıyordu. Bekleme süresince HTTP kapalı olduğundan pod hazır sayılmaz.
     * Çalışma sırasındaki yeniden bağlanma (servislerin 'end' işleyicisi) tek deneme kalır: başarısızlıkta servis
     * yeniden başlar; aksi halde eski istemciyi tutan bileşenler kapalı istemciyle kalırdı.
     * Kod/yapılandırma hatası (geçersiz URL: TypeError) yeniden denenmez.
     */
    async connect(url: string, timeoutMs: number = 30000): Promise<void> {
        const maxWaitMs = this.hasConnected ? 0 : resolveRedisStartupMaxWaitMs();
        const startedAt = Date.now();
        for (let attempt = 1; ; attempt++) {
            try {
                await this.connectOnce(url, timeoutMs);
                this.hasConnected = true;
                if (attempt > 1) {
                    logger.info(`✅ Redis reachable after ${attempt} startup attempts (${Date.now() - startedAt}ms)`);
                }
                return;
            } catch (error) {
                const delay = getRedisStartupRetryDelay(attempt);
                const elapsed = Date.now() - startedAt;
                const giveUp = (error as Error)?.name === 'TypeError'
                    || (maxWaitMs >= 0 && elapsed + delay > maxWaitMs);
                if (giveUp) {
                    throw error;
                }
                logger.warn(`Redis not reachable at startup (attempt ${attempt}, ${elapsed}ms elapsed), retrying in ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    private async connectOnce(url: string, timeoutMs: number): Promise<void> {
        // URL parolayı taşır; yalnızca maskelenmiş biçimi loglanır.
        const safeUrl = maskConnectionUriSecret(url);
        try {
            // URL için önceden oluşturulmuş bir instance var mı kontrol et
            const existingClient = RedisWrapper.instances.get(url);
            if (existingClient) {
                this._client = existingClient;
                this._url = url;
                logger.info(`Reusing existing Redis connection to ${safeUrl}`);
                // Mevcut bağlantının hala çalıştığını doğrula
                try {
                    await existingClient.ping();
                    logger.info('✅ Existing Redis connection validated');
                } catch (pingError) {
                    logger.warn('⚠️ Existing connection failed ping test, removing and reconnecting...');
                    RedisWrapper.instances.delete(url);
                    this._client = undefined;
                    this._url = undefined;
                    // Recursive call to create new connection
                    return this.connectOnce(url, timeoutMs);
                }
                return;
            }

            logger.info(`Connecting to Redis at ${safeUrl} with ${timeoutMs}ms timeout...`);

            // Connection error handling flag
            let connectionFailed = false;
            let connectionError: Error | null = null;

            // UC-1770: adres güvenli ayrıştırılır (geçersizse hata ham adresi taşımaz); parola REDIS_PASSWORD
            // doluysa oradan gelir. İstemciye kimliksiz adres + ayrı kimlik verilir.
            const connection = parseRedisConnectionUrl(url);

            // Yeni bağlantı oluştur - socket timeout, keepalive ve geliştirilmiş reconnect strategy ile
            const client: RedisClientType = createClient<{}, {}, {}>({
                url: connection.url,
                ...(connection.username !== undefined ? { username: connection.username } : {}),
                ...(connection.password !== undefined ? { password: connection.password } : {}),
                socket: {
                    connectTimeout: timeoutMs,
                    keepAlive: 30000, // 30 saniyede bir keepalive paketi gönder
                    noDelay: true, // TCP Nagle algoritmasını devre dışı bırak (düşük latency için)
                    // UC-2494: vazgeçmez. Error döndürmek node-redis'te istemciyi 'end' yaymadan kalıcı kapatıyordu
                    // ("The client is closed"); servislerin 'end' işleyicisi hiç tetiklenmiyordu.
                    reconnectStrategy: (retries) => {
                        const delay = getRedisReconnectDelay(retries);
                        if (retries >= RECONNECT_WARN_AFTER_RETRIES) {
                            logger.warn(`Redis still unreachable, reconnecting in ${delay}ms (attempt ${retries})`);
                        } else {
                            logger.info(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
                        }
                        return delay;
                    }
                }
            })
                .on('connect', () => logger.info(`✅ Redis Client Connected to ${safeUrl}`))
                .on('error', (err) => {
                    logger.error('❌ Redis Client Error:', sanitizeConnectionError(err));
                    connectionError = err as Error;
                    connectionFailed = true;
                })
                .on('reconnecting', () => logger.warn('🔄 Redis Client Reconnecting...'))
                .on('ready', () => this.endedClients.delete(client))
                .on('end', () => {
                    // 'end' yalnız quit()/disconnect() ile yayılır: bilinçli kapanış, kendiliğinden yeniden açılmaz.
                    this.endedClients.add(client);
                    logger.warn('⚠️ Redis connection ended');
                });

            // Timeout wrapper ile connection - improved error handling
            let timeoutTimer: NodeJS.Timeout | undefined;
            try {
                await Promise.race([
                    client.connect(),
                    new Promise((_, reject) => {
                        timeoutTimer = setTimeout(() => reject(new Error(`Redis connection timeout after ${timeoutMs}ms`)), timeoutMs);
                    })
                ]).finally(() => clearTimeout(timeoutTimer));

                // Connection başarılı, şimdi ping test yap
                logger.info('🔍 Validating Redis connection with ping test...');
                await client.ping();
                logger.info('✅ Redis connection validated successfully');

                // Instance'ı kaydet
                this._client = client;
                this._url = url;
                RedisWrapper.instances.set(url, client);
                logger.info(`✅ Successfully connected to Redis at ${safeUrl}`);

            } catch (connectError) {
                // Connection failed, cleanup client
                logger.error('❌ Redis connection or validation failed, cleaning up...');
                try {
                    if (client.isReady) {
                        await client.quit();
                    } else if (client.isOpen) {
                        // Hazır olmayan istemci kendi yeniden bağlanma döngüsünde: QUIT kuyrukta bekler,
                        // disconnect() döngüyü durdurur (yoksa her açılış denemesi arkada bir istemci bırakırdı).
                        await client.disconnect();
                    }
                } catch (quitError) {
                    logger.warn('Failed to quit client during cleanup:', sanitizeConnectionError(quitError));
                }
                throw connectError;
            }

            // Check if async error occurred during connection
            if (connectionFailed && connectionError) {
                logger.error('❌ Async connection error detected:', sanitizeConnectionError(connectionError));
                throw connectionError;
            }

        } catch (error) {
            const safeError = sanitizeConnectionError(error);
            logger.error('❌ Failed to connect to Redis:', safeError);
            throw toSafeError(safeError);
        }
    }

    // Order işlemleri için metodlar
    async deleteOrder(userId: string, purchaseNumber: string, platformNumber: string) {
        const key = `user:${userId}:order:${purchaseNumber}:${platformNumber}`;
        const result = await this.client.del(key);
        if (result === 1) {
            logger.info(`${key} deleted.`);
            return true;
        }
        logger.info(`${key} not found for delete or deleted.`);
        return false;
    }

    async setOrder(userId: string, purchaseNumber: string, platformNumber: string, orderData: object) {
        const key = `user:${userId}:order:${purchaseNumber}:${platformNumber}`;
        await this.client.hSet(key, this.toHashFields(orderData));
    }

    async getOrder(userId: string, purchaseNumber: string, platformNumber: string) {
        const key = `user:${userId}:order:${purchaseNumber}:${platformNumber}`;
        const data = await this.client.hGetAll(key);
        return Object.keys(data).length > 0 ? data : null;
    }

    async updateOrderStatus(userId: string, purchaseNumber: string, platformNumber: string, status: string) {
        const key = `user:${userId}:order:${purchaseNumber}:${platformNumber}`;
        await this.client.hSet(key, 'status', status);
    }
    
    async deleteCredentials(userId: string, platform: string) {
        const key = `user:${userId}:platform:${platform}:credentials`;
        const result = await this.client.del(key);
        if (result === 1) {
            logger.info(`${key} deleted.`);
        } else {
            logger.info(`${key} not found for delete or deleted.`);
        }
    }

    async setCredentials(userId: string, platform: string, credentials: object) {
        const key = `user:${userId}:platform:${platform}:credentials`;
        await this.client.hSet(key, this.toHashFields(credentials));
    }

    async getCredentials(userId: string, platform: string) {
        const key = `user:${userId}:platform:${platform}:credentials`;;
        const data = await this.client.hGetAll(key);
        if (Object.keys(data).length > 0) return data;
        return null;
    }

    async updateCredentials(userId: string, platform: string, credentials: any) {
        await this.deleteCredentials(userId, platform);
        return this.setCredentials(userId, platform, credentials);
    }

    // Lua script çalıştırma metodu
    async eval(script: string, params: { keys: string[], arguments: string[] }): Promise<any> {
        if (!this.client) {
            throw new Error('Redis client not connected');
        }
        
        return this.client.EVAL(script, {
            keys: params.keys,
            arguments: params.arguments
        });
    }

    // SET NX için ek parametre desteği
    async setNX(key: string, value: string, expireSeconds: number): Promise<boolean> {
        if (!this.client) {
            throw new Error('Redis client not connected');
        }
        
        const result = await this.client.set(key, value, {
            NX: true,
            EX: expireSeconds
        });
        
        return result === 'OK';
    }

    /**
     * Objeyi Redis hash field'larına dönüştürür — double serialization olmadan.
     * undefined/null değerleri atlar, nested objeleri JSON.stringify ile serialize eder.
     */
    private toHashFields(data: object): Record<string, string> {
        const result: Record<string, string> = {};
        for (const [key, value] of Object.entries(data)) {
            if (value === undefined || value === null) continue;
            result[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
        }
        return result;
    }

    // Uygulama kapanırken bağlantıyı kapat
    async disconnect() {
        if (this._client && this._url) {
            await this._client.quit();
            RedisWrapper.instances.delete(this._url);
            this._client = undefined;
            this._url = undefined;
        }
    }

    // Connection monitoring metodları
    getConnectionStats() {
        return {
            totalInstances: RedisWrapper.instances.size,
            currentUrl: maskConnectionUriSecret(this._url),
            isConnected: !!this._client
        };
    }

    getActiveConnections() {
        return RedisWrapper.instances.size;
    }

    // Tüm instance'ları listele (debugging için)
    static getInstanceUrls(): string[] {
        return Array.from(RedisWrapper.instances.keys()).map((url) => maskConnectionUriSecret(url) as string);
    }
}

export const redisWrapper = new RedisWrapper();