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
    async connect(url, timeoutMs = 30000) {
        try {
            // URL için önceden oluşturulmuş bir instance var mı kontrol et
            const existingClient = RedisWrapper.instances.get(url);
            if (existingClient) {
                this._client = existingClient;
                this._url = url;
                logger_service_1.logger.info(`Reusing existing Redis connection to ${url}`);
                // Mevcut bağlantının hala çalıştığını doğrula
                try {
                    await existingClient.ping();
                    logger_service_1.logger.info('✅ Existing Redis connection validated');
                }
                catch (pingError) {
                    logger_service_1.logger.warn('⚠️ Existing connection failed ping test, removing and reconnecting...');
                    RedisWrapper.instances.delete(url);
                    this._client = undefined;
                    this._url = undefined;
                    // Recursive call to create new connection
                    return this.connect(url, timeoutMs);
                }
                return;
            }
            logger_service_1.logger.info(`Connecting to Redis at ${url} with ${timeoutMs}ms timeout...`);
            // Connection error handling flag
            let connectionFailed = false;
            let connectionError = null;
            // Yeni bağlantı oluştur - socket timeout, keepalive ve geliştirilmiş reconnect strategy ile
            const client = (0, redis_1.createClient)({
                url,
                socket: {
                    connectTimeout: timeoutMs,
                    keepAlive: 30000, // 30 saniyede bir keepalive paketi gönder
                    noDelay: true, // TCP Nagle algoritmasını devre dışı bırak (düşük latency için)
                    reconnectStrategy: (retries) => {
                        // Max 10 deneme ile daha dayanıklı reconnect
                        if (retries > 10) {
                            logger_service_1.logger.error(`Redis reconnection failed after ${retries} attempts`);
                            return new Error('Max reconnection attempts reached');
                        }
                        // Exponential backoff with max 30 seconds
                        const delay = Math.min(Math.pow(2, retries) * 1000, 30000);
                        logger_service_1.logger.info(`Redis reconnecting in ${delay}ms (attempt ${retries}/10)`);
                        return delay;
                    }
                }
            })
                .on('connect', () => logger_service_1.logger.info(`✅ Redis Client Connected to ${url}`))
                .on('error', (err) => {
                logger_service_1.logger.error('❌ Redis Client Error:', err);
                connectionError = err;
                connectionFailed = true;
            })
                .on('reconnecting', () => logger_service_1.logger.warn('🔄 Redis Client Reconnecting...'))
                .on('end', () => logger_service_1.logger.warn('⚠️ Redis connection ended'));
            // Timeout wrapper ile connection - improved error handling
            try {
                await Promise.race([
                    client.connect(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error(`Redis connection timeout after ${timeoutMs}ms`)), timeoutMs))
                ]);
                // Connection başarılı, şimdi ping test yap
                logger_service_1.logger.info('🔍 Validating Redis connection with ping test...');
                await client.ping();
                logger_service_1.logger.info('✅ Redis connection validated successfully');
                // Instance'ı kaydet
                this._client = client;
                this._url = url;
                RedisWrapper.instances.set(url, client);
                logger_service_1.logger.info(`✅ Successfully connected to Redis at ${url}`);
            }
            catch (connectError) {
                // Connection failed, cleanup client
                logger_service_1.logger.error('❌ Redis connection or validation failed, cleaning up...');
                try {
                    if (client.isOpen) {
                        await client.quit();
                    }
                }
                catch (quitError) {
                    logger_service_1.logger.warn('Failed to quit client during cleanup:', quitError);
                }
                throw connectError;
            }
            // Check if async error occurred during connection
            if (connectionFailed && connectionError) {
                logger_service_1.logger.error('❌ Async connection error detected:', connectionError);
                throw connectionError;
            }
        }
        catch (error) {
            logger_service_1.logger.error('❌ Failed to connect to Redis:', error);
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
        await this.client.hSet(key, this.toHashFields(orderData));
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
        await this.client.hSet(key, this.toHashFields(credentials));
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
    /**
     * Objeyi Redis hash field'larına dönüştürür — double serialization olmadan.
     * undefined/null değerleri atlar, nested objeleri JSON.stringify ile serialize eder.
     */
    toHashFields(data) {
        const result = {};
        for (const [key, value] of Object.entries(data)) {
            if (value === undefined || value === null)
                continue;
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
            currentUrl: this._url,
            isConnected: !!this._client
        };
    }
    getActiveConnections() {
        return RedisWrapper.instances.size;
    }
    // Tüm instance'ları listele (debugging için)
    static getInstanceUrls() {
        return Array.from(RedisWrapper.instances.keys());
    }
}
RedisWrapper.instances = new Map();
exports.redisWrapper = new RedisWrapper();
//# sourceMappingURL=redisWrapper.service.js.map