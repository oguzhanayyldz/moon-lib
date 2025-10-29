import { createClient, RedisClientType } from 'redis';
import { logger } from './logger.service';


class RedisWrapper {
    private static instances: Map<string, RedisClientType> = new Map();
    private _client?: RedisClientType;
    private _url?: string;

    get client() {
        if (!this._client) {
            throw new Error('Cannot access Redis client before connecting');
        }
        return this._client;
    }

    async connect(url: string, timeoutMs: number = 10000) {
        try {
            // URL için önceden oluşturulmuş bir instance var mı kontrol et
            const existingClient = RedisWrapper.instances.get(url);
            if (existingClient) {
                this._client = existingClient;
                this._url = url;
                logger.info(`Reusing existing Redis connection to ${url}`);
                return;
            }

            logger.info(`Connecting to Redis at ${url} with ${timeoutMs}ms timeout...`);

            // Yeni bağlantı oluştur - socket timeout ve reconnect strategy ile
            const client: RedisClientType = createClient<{}, {}, {}>({
                url,
                socket: {
                    connectTimeout: timeoutMs,
                    reconnectStrategy: (retries) => {
                        if (retries > 3) {
                            logger.error(`Redis reconnection failed after ${retries} attempts`);
                            return new Error('Max reconnection attempts reached');
                        }
                        const delay = Math.min(retries * 100, 3000);
                        logger.info(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
                        return delay;
                    }
                }
            })
                .on('connect', () => logger.info(`✅ Redis Client Connected to ${url}`))
                .on('error', (err) => logger.error('❌ Redis Client Error:', err))
                .on('reconnecting', () => logger.warn('🔄 Redis Client Reconnecting...'));

            // Timeout wrapper ile connection
            const connectWithTimeout = Promise.race([
                client.connect(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(`Redis connection timeout after ${timeoutMs}ms`)), timeoutMs)
                )
            ]);

            await connectWithTimeout;

            // Instance'ı kaydet
            this._client = client;
            this._url = url;
            RedisWrapper.instances.set(url, client);
            logger.info(`✅ Successfully connected to Redis at ${url}`);

        } catch (error) {
            logger.error('❌ Failed to connect to Redis:', error);
            throw error;
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

    async setOrder(userId: string, purchaseNumber: string, platformNumber: string, orderData: any) {
        const key = `user:${userId}:order:${purchaseNumber}:${platformNumber}`;
        await this.client.hSet(key, JSON.parse(JSON.stringify(orderData)));
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

    async setCredentials(userId: string, platform: string, credentials: any) {
        const key = `user:${userId}:platform:${platform}:credentials`;
        await this.client.hSet(key, JSON.parse(JSON.stringify(credentials)));
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
            currentUrl: this._url,
            isConnected: !!this._client
        };
    }

    getActiveConnections() {
        return RedisWrapper.instances.size;
    }

    // Tüm instance'ları listele (debugging için)
    static getInstanceUrls(): string[] {
        return Array.from(RedisWrapper.instances.keys());
    }
}

export const redisWrapper = new RedisWrapper();