import { createClient, RedisClientType } from 'redis';

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

    async connect(url: string) {
        try {
            // URL için önceden oluşturulmuş bir instance var mı kontrol et
            const existingClient = RedisWrapper.instances.get(url);
            if (existingClient) {
                this._client = existingClient;
                this._url = url;
                return;
            }

            // Yeni bağlantı oluştur
            const client: RedisClientType = createClient<{}, {}, {}>({ url })
                .on('connect', () => console.log(`Redis Client Connected to ${url}`))
                .on('error', (err) => console.error('Redis Client Error:', err));

            await client.connect();
            
            // Instance'ı kaydet
            this._client = client;
            this._url = url;
            RedisWrapper.instances.set(url, client);

        } catch (error) {
            console.error('Failed to connect to Redis:', error);
            throw error;
        }
    }

    // Order işlemleri için metodlar
    async deleteOrder(userId: string, purchaseNumber: string, platformNumber: string) {
        const key = `user:${userId}:order:${purchaseNumber}:${platformNumber}`;
        const result = await this.client.del(key);
        if (result === 1) {
            console.log(`${key} deleted.`);
            return true;
        }
        console.log(`${key} not found for delete or deleted.`);
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
            console.log(`${key} deleted.`);
        } else {
            console.log(`${key} not found for delete or deleted.`);
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

    // Uygulama kapanırken bağlantıyı kapat
    async disconnect() {
        if (this._client && this._url) {
            await this._client.quit();
            RedisWrapper.instances.delete(this._url);
            this._client = undefined;
            this._url = undefined;
        }
    }
}

export const redisWrapper = new RedisWrapper();