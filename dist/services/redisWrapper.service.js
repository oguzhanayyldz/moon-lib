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
    connect(url) {
        return __awaiter(this, void 0, void 0, function* () {
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
                yield client.connect();
                // Instance'ı kaydet
                this._client = client;
                this._url = url;
                RedisWrapper.instances.set(url, client);
            }
            catch (error) {
                logger_service_1.logger.error('Failed to connect to Redis:', error);
                throw error;
            }
        });
    }
    // Order işlemleri için metodlar
    deleteOrder(userId, purchaseNumber, platformNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `user:${userId}:order:${purchaseNumber}:${platformNumber}`;
            const result = yield this.client.del(key);
            if (result === 1) {
                logger_service_1.logger.info(`${key} deleted.`);
                return true;
            }
            logger_service_1.logger.info(`${key} not found for delete or deleted.`);
            return false;
        });
    }
    setOrder(userId, purchaseNumber, platformNumber, orderData) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `user:${userId}:order:${purchaseNumber}:${platformNumber}`;
            yield this.client.hSet(key, JSON.parse(JSON.stringify(orderData)));
        });
    }
    getOrder(userId, purchaseNumber, platformNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `user:${userId}:order:${purchaseNumber}:${platformNumber}`;
            const data = yield this.client.hGetAll(key);
            return Object.keys(data).length > 0 ? data : null;
        });
    }
    updateOrderStatus(userId, purchaseNumber, platformNumber, status) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `user:${userId}:order:${purchaseNumber}:${platformNumber}`;
            yield this.client.hSet(key, 'status', status);
        });
    }
    deleteCredentials(userId, platform) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `user:${userId}:platform:${platform}:credentials`;
            const result = yield this.client.del(key);
            if (result === 1) {
                logger_service_1.logger.info(`${key} deleted.`);
            }
            else {
                logger_service_1.logger.info(`${key} not found for delete or deleted.`);
            }
        });
    }
    setCredentials(userId, platform, credentials) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `user:${userId}:platform:${platform}:credentials`;
            yield this.client.hSet(key, JSON.parse(JSON.stringify(credentials)));
        });
    }
    getCredentials(userId, platform) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `user:${userId}:platform:${platform}:credentials`;
            ;
            const data = yield this.client.hGetAll(key);
            if (Object.keys(data).length > 0)
                return data;
            return null;
        });
    }
    updateCredentials(userId, platform, credentials) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.deleteCredentials(userId, platform);
            return this.setCredentials(userId, platform, credentials);
        });
    }
    // Lua script çalıştırma metodu
    eval(script, params) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.client) {
                throw new Error('Redis client not connected');
            }
            return this.client.EVAL(script, {
                keys: params.keys,
                arguments: params.arguments
            });
        });
    }
    // SET NX için ek parametre desteği
    setNX(key, value, expireSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.client) {
                throw new Error('Redis client not connected');
            }
            const result = yield this.client.set(key, value, {
                NX: true,
                EX: expireSeconds
            });
            return result === 'OK';
        });
    }
    // Uygulama kapanırken bağlantıyı kapat
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._client && this._url) {
                yield this._client.quit();
                RedisWrapper.instances.delete(this._url);
                this._client = undefined;
                this._url = undefined;
            }
        });
    }
}
RedisWrapper.instances = new Map();
exports.redisWrapper = new RedisWrapper();
