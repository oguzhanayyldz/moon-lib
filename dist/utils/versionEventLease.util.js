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
exports.VersionEventLeases = void 0;
exports.versionInflightKey = versionInflightKey;
exports.versionLatestKey = versionLatestKey;
const redisEnvScope_util_1 = require("./redisEnvScope.util");
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
const DECISIONS = { 0: 'inflight', 1: 'acquired', 2: 'delivered' };
function versionInflightKey(entity) {
    return (0, redisEnvScope_util_1.envScopedKey)(`vsync:inflight:${entity.service}:${entity.entityType}:${entity.entityId}`);
}
function versionLatestKey(entity) {
    return (0, redisEnvScope_util_1.envScopedKey)(`vsync:latest:${entity.service}:${entity.entityType}:${entity.entityId}`);
}
function withTimeout(promise, timeoutMs) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Redis lease call timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
/**
 * Hata/zaman aşımı yukarı atılır; çağıran (EventPublisherJob) Redis'siz Mongo claim'iyle devam eder.
 * İstemci her çağrıda yeniden alınır: bağlantı sonradan kurulursa ya da koparsa kendiliğinden izlenir.
 */
class VersionEventLeases {
    constructor(getRedis, options) {
        this.getRedis = getRedis;
        this.options = options;
    }
    acquire(entities, token) {
        return __awaiter(this, void 0, void 0, function* () {
            if (entities.length === 0)
                return [];
            const keys = entities.flatMap(e => [versionInflightKey(e), versionLatestKey(e)]);
            const args = [token, String(this.options.leaseMs), ...entities.map(e => String(e.version))];
            const raw = yield withTimeout(this.getRedis().eval(ACQUIRE_SCRIPT, { keys, arguments: args }), this.options.timeoutMs);
            if (!Array.isArray(raw) || raw.length !== entities.length) {
                throw new Error('Unexpected Redis lease acquire reply');
            }
            return raw.map(code => {
                const decision = DECISIONS[Number(code)];
                if (!decision)
                    throw new Error('Unexpected Redis lease acquire reply');
                return decision;
            });
        });
    }
    markDelivered(entities) {
        return __awaiter(this, void 0, void 0, function* () {
            if (entities.length === 0)
                return;
            const keys = entities.map(versionLatestKey);
            const args = [String(this.options.latestTtlMs), ...entities.map(e => String(e.version))];
            yield withTimeout(this.getRedis().eval(MARK_DELIVERED_SCRIPT, { keys, arguments: args }), this.options.timeoutMs);
        });
    }
    /** @returns kira bırakılırken artık bu sahibin olmayan (süresi dolmuş) kira sayısı */
    release(entities, token) {
        return __awaiter(this, void 0, void 0, function* () {
            if (entities.length === 0)
                return 0;
            const keys = entities.map(versionInflightKey);
            const args = [token, ...entities.map(e => String(e.version))];
            const expired = yield withTimeout(this.getRedis().eval(RELEASE_SCRIPT, { keys, arguments: args }), this.options.timeoutMs);
            return Number(expired) || 0;
        });
    }
}
exports.VersionEventLeases = VersionEventLeases;
