"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisWrapper = void 0;
const redis_1 = require("redis");
const logger_service_1 = require("./logger.service");
class RedisWrapper {
    get client() {
        if (!this._client) {
            throw new Error('Cannot access Redis client before connecting');
        }
        return this._client;
    }
    async connect(url) {
        try {
            // URL için önceden oluşturulmuş bir instance var mı kontrol et
            const existingClient = RedisWrapper.instances.get(url);
            if (existingClient) {
                this._client = existingClient;
                this._url = url;
                return;
            }
            // Yeni bağlantı oluştur
            const client = (0, redis_1.createClient)({ url })
                .on('connect', () => logger_service_1.logger.info(`Redis Client Connected to ${url}`))
                .on('error', (err) => logger_service_1.logger.error('Redis Client Error:', err));
            await client.connect();
            // Instance'ı kaydet
            this._client = client;
            this._url = url;
            RedisWrapper.instances.set(url, client);
        }
        catch (error) {
            logger_service_1.logger.error('Failed to connect to Redis:', error);
            throw error;
        }
    }
    // Order işlemleri için metodlar
    async deleteOrder(userId, purchaseNumber, platformNumber) {
        const key = `user:${userId}:order:${purchaseNumber}:${platformNumber}`;
        const result = await this.client.del(key);
        if (result === 1) {
            logger_service_1.logger.info(`${key} deleted.`);
            return true;
        }
        logger_service_1.logger.info(`${key} not found for delete or deleted.`);
        return false;
    }
    async setOrder(userId, purchaseNumber, platformNumber, orderData) {
        const key = `user:${userId}:order:${purchaseNumber}:${platformNumber}`;
        await this.client.hSet(key, JSON.parse(JSON.stringify(orderData)));
    }
    async getOrder(userId, purchaseNumber, platformNumber) {
        const key = `user:${userId}:order:${purchaseNumber}:${platformNumber}`;
        const data = await this.client.hGetAll(key);
        return Object.keys(data).length > 0 ? data : null;
    }
    async updateOrderStatus(userId, purchaseNumber, platformNumber, status) {
        const key = `user:${userId}:order:${purchaseNumber}:${platformNumber}`;
        await this.client.hSet(key, 'status', status);
    }
    async deleteCredentials(userId, platform) {
        const key = `user:${userId}:platform:${platform}:credentials`;
        const result = await this.client.del(key);
        if (result === 1) {
            logger_service_1.logger.info(`${key} deleted.`);
        }
        else {
            logger_service_1.logger.info(`${key} not found for delete or deleted.`);
        }
    }
    async setCredentials(userId, platform, credentials) {
        const key = `user:${userId}:platform:${platform}:credentials`;
        await this.client.hSet(key, JSON.parse(JSON.stringify(credentials)));
    }
    async getCredentials(userId, platform) {
        const key = `user:${userId}:platform:${platform}:credentials`;
        ;
        const data = await this.client.hGetAll(key);
        if (Object.keys(data).length > 0)
            return data;
        return null;
    }
    async updateCredentials(userId, platform, credentials) {
        await this.deleteCredentials(userId, platform);
        return this.setCredentials(userId, platform, credentials);
    }
    // Lua script çalıştırma metodu
    async eval(script, params) {
        if (!this.client) {
            throw new Error('Redis client not connected');
        }
        return this.client.EVAL(script, {
            keys: params.keys,
            arguments: params.arguments
        });
    }
    // SET NX için ek parametre desteği
    async setNX(key, value, expireSeconds) {
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
}
RedisWrapper.instances = new Map();
exports.redisWrapper = new RedisWrapper();
//# sourceMappingURL=redisWrapper.service.js.map