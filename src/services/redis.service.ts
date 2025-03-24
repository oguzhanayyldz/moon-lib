import { createClient, RedisClientType } from 'redis';

export interface RedisConfig {
    url?: string;
}

export class RedisService {
    private _client?: RedisClientType;

    get client() {
        if (!this._client) {
            throw new Error("Cannot access Redis client before connecting");
        }
        return this._client;
    }

    async connect(config?: RedisConfig) {
        try {
            const client = createClient({ url: config?.url }) as RedisClientType;
            client.on('connect', () => console.log('Redis Client Connected'));
            client.on('error', (err: any) => console.log('Redis Client Error', err));

            await client.connect();
            this._client = client;
        } catch (error) {
            console.error('Failed to connect to Redis:', error);
            throw error;
        }
    }

    async deleteCredentials(userId: string, platform: string) {
        const key = `user:${userId}:platform:${platform}:credentials`;
        const result = await this.client.del(key);
        return result === 1;
    }

    async setCredentials(userId: string, platform: string, credentials: any) {
        const key = `user:${userId}:platform:${platform}:credentials`;
        await this.client.hSet(key, JSON.parse(JSON.stringify(credentials)));
    }

    async getCredentials(userId: string, platform: string) {
        const key = `user:${userId}:platform:${platform}:credentials`;
        const data = await this.client.hGetAll(key);
        return Object.keys(data).length > 0 ? data : null;
    }

    async updateCredentials(userId: string, platform: string, credentials: any) {
        await this.deleteCredentials(userId, platform);
        return this.setCredentials(userId, platform, credentials);
    }

    // Order related methods
    async setOrder(orderId: string, data: any) {
        const key = `order:${orderId}`;
        await this.client.hSet(key, JSON.parse(JSON.stringify(data)));
    }

    async getOrder(orderId: string) {
        const key = `order:${orderId}`;
        const data = await this.client.hGetAll(key);
        return Object.keys(data).length > 0 ? data : null;
    }

    async deleteOrder(orderId: string) {
        const key = `order:${orderId}`;
        const result = await this.client.del(key);
        return result === 1;
    }

    async updateOrderStatus(orderId: string, status: string) {
        const key = `order:${orderId}`;
        await this.client.hSet(key, { status });
    }
}

export const createRedisService = () => new RedisService();