/**
 * In-memory Redis fake for event-delivery tests (issue #648).
 *
 * Implements only the commands RetryableListener and RetryManager use, with
 * Redis semantics (SET NX/EX, TTL -2/-1, compare-and-delete lock release).
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

    async ttl(key: string): Promise<number> {
        const entry = this.liveEntry(key);
        if (!entry) return -2;
        if (entry.expiresAt === null) return -1;
        return Math.round((entry.expiresAt - Date.now()) / 1000);
    }

    async eval(script: string, options: EvalOptions): Promise<number> {
        if (!LOCK_RELEASE_SCRIPT_PARTS.every(part => script.includes(part))) {
            throw new Error('InMemoryRedis.eval: only the compare-and-delete lock release script is supported');
        }
        const [key] = options.keys;
        const [expectedValue] = options.arguments;
        if ((await this.get(key)) === expectedValue) {
            return this.del(key);
        }
        return 0;
    }

    flushAll(): void {
        this.store.clear();
    }
}
