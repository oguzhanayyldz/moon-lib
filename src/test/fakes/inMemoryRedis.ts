/**
 * In-memory Redis fake for event-delivery tests (issue #648).
 *
 * Implements only the commands RetryableListener and RetryManager use, with
 * Redis semantics (SET NX/EX, TTL -2/-1, compare-and-delete lock release, owner-checked lock renew).
 * Anything else throws, so a test can never pass against a silently missing command.
 */
interface Entry {
    value: string;
    expiresAt: number | null;
}

interface SetOptions {
    NX?: boolean;
    EX?: number;
}

interface EvalOptions {
    keys: string[];
    arguments: string[];
}

// utils/lockHeartbeat.util LOCK_RENEW_SCRIPT; matched by content so the fake does not import the mocked redisWrapper
const LOCK_RENEW_SCRIPT_PARTS = ['redis.call("expire", KEYS[1], ARGV[3])', 'string.sub(v, -string.len(ARGV[2])) == ARGV[2]'];
const LOCK_RELEASE_SCRIPT_PARTS = ['redis.call("get", KEYS[1]) == ARGV[1]', 'redis.call("del", KEYS[1])'];

export class InMemoryRedis {
    private store = new Map<string, Entry>();

    private liveEntry(key: string): Entry | undefined {
        const entry = this.store.get(key);
        if (!entry) return undefined;
        if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
            this.store.delete(key);
            return undefined;
        }
        return entry;
    }

    async get(key: string): Promise<string | null> {
        return this.liveEntry(key)?.value ?? null;
    }

    async set(key: string, value: string, options: SetOptions = {}): Promise<'OK' | null> {
        if (options.NX && this.liveEntry(key)) {
            return null;
        }
        const expiresAt = options.EX !== undefined ? Date.now() + options.EX * 1000 : null;
        this.store.set(key, { value, expiresAt });
        return 'OK';
    }

    async del(key: string): Promise<number> {
        const existed = this.liveEntry(key) !== undefined;
        this.store.delete(key);
        return existed ? 1 : 0;
    }

    async incr(key: string): Promise<number> {
        const entry = this.liveEntry(key);
        const next = Number(entry?.value ?? 0) + 1;
        this.store.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
        return next;
    }

    async expire(key: string, seconds: number): Promise<number> {
        const entry = this.liveEntry(key);
        if (!entry) return 0;
        entry.expiresAt = Date.now() + seconds * 1000;
        return 1;
    }

    async ttl(key: string): Promise<number> {
        const entry = this.liveEntry(key);
        if (!entry) return -2;
        if (entry.expiresAt === null) return -1;
        return Math.round((entry.expiresAt - Date.now()) / 1000);
    }

    async eval(script: string, options: EvalOptions): Promise<number> {
        if (LOCK_RENEW_SCRIPT_PARTS.every(part => script.includes(part))) {
            return this.renewLock(options);
        }
        if (!LOCK_RELEASE_SCRIPT_PARTS.every(part => script.includes(part))) {
            throw new Error('InMemoryRedis.eval: only the lock release and lock renew scripts are supported');
        }
        const [key] = options.keys;
        const [expectedValue] = options.arguments;
        if ((await this.get(key)) === expectedValue) {
            return this.del(key);
        }
        return 0;
    }

    /** LOCK_RENEW_SCRIPT: value matches exactly (or ends with the suffix when no exact value is given) → expire, 1. */
    private async renewLock(options: EvalOptions): Promise<number> {
        const [key] = options.keys;
        const [expectedValue, suffix, ttlSec] = options.arguments;
        const entry = this.liveEntry(key);
        if (!entry) return 0;
        const owned = expectedValue !== '' ? entry.value === expectedValue : suffix !== '' && entry.value.endsWith(suffix);
        if (!owned) return 0;
        entry.expiresAt = Date.now() + Number(ttlSec) * 1000;
        return 1;
    }

    flushAll(): void {
        this.store.clear();
    }
}
