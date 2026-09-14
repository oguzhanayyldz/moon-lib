import {
    DEFAULT_BULL_PREFIX,
    envBullPrefix,
    envScopedKey,
    envScopedPattern,
    getRedisKeyEnvironment,
    isRedisEnvScoped,
    REDIS_KEY_ENV_VARIABLE,
    stripEnvScope
} from '../utils/redisEnvScope.util';

/**
 * Environment-scoped Redis names (ENV-ISO, TASK-MU1QNQKCOKD07).
 *
 * The production contract is the one that must never break: every helper returns its
 * input unchanged, otherwise a deploy would rename live queues and orphan delayed jobs.
 * So production is checked for NODE_ENV=production AND for a missing/empty NODE_ENV
 * (the outbox default), with real key shapes from the services. REDIS_KEY_ENV overrides
 * NODE_ENV for deployments whose NODE_ENV is not `production` (invoice, shipment).
 */

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_REDIS_KEY_ENV = process.env.REDIS_KEY_ENV;

function setEnvVariable(name: string, value: string | undefined): void {
    if (value === undefined) {
        delete process.env[name];
    } else {
        process.env[name] = value;
    }
}

function setNodeEnv(value: string | undefined): void {
    setEnvVariable('NODE_ENV', value);
}

function setRedisKeyEnv(value: string | undefined): void {
    setEnvVariable('REDIS_KEY_ENV', value);
}

/**
 * Minimal Redis glob matcher (`*`, `?`, `[...]`, backslash escape) used to prove what a
 * SCAN MATCH pattern would return from a shared keyspace.
 */
function redisGlobMatches(pattern: string, key: string): boolean {
    let source = '';
    for (let i = 0; i < pattern.length; i++) {
        const char = pattern[i];
        if (char === '\\' && i + 1 < pattern.length) {
            i++;
            source += pattern[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        } else if (char === '*') {
            source += '.*';
        } else if (char === '?') {
            source += '.';
        } else if (char === '[') {
            const end = pattern.indexOf(']', i + 1);
            source += end === -1 ? '\\[' : `[${pattern.slice(i + 1, end)}]`;
            i = end === -1 ? i : end;
        } else {
            source += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
    }
    return new RegExp(`^${source}$`).test(key);
}

// Real key shapes: catalog stock queue, moon-lib listener lock and retry counter.
const SERVICE_KEYS = [
    'stock-update-queue:64f1a2b3c4d5e6f7a8b9c0d1:shopify',
    'lock:product:stock:updated:svc-stock-42-v3',
    'event:retry:product:stock:updated:svc-stock-42-v3',
    'campaign-scheduler-coordinator'
];

describe('redisEnvScope util', () => {
    beforeEach(() => {
        // An override left in the runner's shell must not decide the NODE_ENV tests.
        setRedisKeyEnv(undefined);
    });

    afterEach(() => {
        setNodeEnv(ORIGINAL_NODE_ENV);
        setRedisKeyEnv(ORIGINAL_REDIS_KEY_ENV);
    });

    describe('environment source without REDIS_KEY_ENV (same as outbox: NODE_ENV || production)', () => {
        it('falls back to production when NODE_ENV is missing', () => {
            setNodeEnv(undefined);
            expect(getRedisKeyEnvironment()).toBe('production');
            expect(isRedisEnvScoped()).toBe(false);
        });

        it('falls back to production when NODE_ENV is empty', () => {
            setNodeEnv('');
            expect(getRedisKeyEnvironment()).toBe('production');
            expect(isRedisEnvScoped()).toBe(false);
        });

        it('uses the NODE_ENV value otherwise', () => {
            setNodeEnv('development');
            expect(getRedisKeyEnvironment()).toBe('development');
            expect(isRedisEnvScoped()).toBe(true);

            setNodeEnv('test');
            expect(getRedisKeyEnvironment()).toBe('test');
            expect(isRedisEnvScoped()).toBe(true);
        });

        it('reads NODE_ENV on every call instead of caching it at module load', () => {
            setNodeEnv('development');
            expect(envScopedKey('a:b')).toBe('development:a:b');
            setNodeEnv('production');
            expect(envScopedKey('a:b')).toBe('a:b');
            setNodeEnv('test');
            expect(envScopedKey('a:b')).toBe('test:a:b');
        });
    });

    describe('REDIS_KEY_ENV override (REDIS_KEY_ENV || NODE_ENV || production)', () => {
        it('uses the REDIS_KEY_ENV variable name', () => {
            expect(REDIS_KEY_ENV_VARIABLE).toBe('REDIS_KEY_ENV');
        });

        it('REDIS_KEY_ENV=production keeps every name unchanged although NODE_ENV=development (invoice/shipment in production)', () => {
            setNodeEnv('development');
            setRedisKeyEnv('production');

            expect(getRedisKeyEnvironment()).toBe('production');
            expect(isRedisEnvScoped()).toBe(false);
            for (const key of SERVICE_KEYS) {
                expect(envScopedKey(key)).toBe(key);
            }
            expect(envScopedPattern('stock-update-queue:*')).toBe('stock-update-queue:*');
            expect(stripEnvScope('development:stock-update-queue:u1:shopify'))
                .toBe('development:stock-update-queue:u1:shopify');
            expect(envBullPrefix()).toBe('bull');
        });

        it('REDIS_KEY_ENV also wins when it names a non-production environment', () => {
            setNodeEnv('production');
            setRedisKeyEnv('development');

            expect(getRedisKeyEnvironment()).toBe('development');
            expect(envScopedKey('lock:s:e1')).toBe('development:lock:s:e1');
            expect(envBullPrefix()).toBe('development-bull');
        });

        it.each([
            ['development', 'development:lock:s:e1', 'development-bull'],
            ['production', 'lock:s:e1', 'bull'],
            [undefined, 'lock:s:e1', 'bull']
        ])('REDIS_KEY_ENV missing keeps the NODE_ENV behaviour (NODE_ENV=%s)', (nodeEnv, expectedKey, expectedPrefix) => {
            setNodeEnv(nodeEnv);

            expect(getRedisKeyEnvironment()).toBe(nodeEnv ?? 'production');
            expect(envScopedKey('lock:s:e1')).toBe(expectedKey);
            expect(envBullPrefix()).toBe(expectedPrefix);
        });

        it.each([
            ['development', 'development', 'development:lock:s:e1'],
            [undefined, 'production', 'lock:s:e1']
        ])('an empty REDIS_KEY_ENV is ignored (NODE_ENV=%s)', (nodeEnv, expectedEnvironment, expectedKey) => {
            setNodeEnv(nodeEnv);
            setRedisKeyEnv('');

            expect(getRedisKeyEnvironment()).toBe(expectedEnvironment);
            expect(envScopedKey('lock:s:e1')).toBe(expectedKey);
            expect(envScopedPattern('lock:*')).toBe(expectedKey.replace('s:e1', '*'));
        });

        it('reads REDIS_KEY_ENV on every call instead of caching it at module load', () => {
            setNodeEnv('development');
            expect(envScopedKey('a:b')).toBe('development:a:b');
            setRedisKeyEnv('production');
            expect(envScopedKey('a:b')).toBe('a:b');
            setRedisKeyEnv(undefined);
            expect(envScopedKey('a:b')).toBe('development:a:b');
        });
    });

    describe.each([
        ['NODE_ENV=production', 'production'],
        ['NODE_ENV missing', undefined],
        ['NODE_ENV empty', '']
    ])('production contract (%s): every name stays byte-for-byte identical', (_label, value) => {
        beforeEach(() => {
            setNodeEnv(value);
        });

        it('envScopedKey returns every service key unchanged', () => {
            for (const key of SERVICE_KEYS) {
                expect(envScopedKey(key)).toBe(key);
            }
        });

        it('envScopedPattern returns SCAN patterns unchanged', () => {
            expect(envScopedPattern('stock-update-queue:*')).toBe('stock-update-queue:*');
            expect(envScopedPattern('stock-update-lock:*')).toBe('stock-update-lock:*');
        });

        it('stripEnvScope never strips, even a key that looks like another environment', () => {
            expect(stripEnvScope('development:stock-update-queue:u1:shopify'))
                .toBe('development:stock-update-queue:u1:shopify');
            expect(stripEnvScope('production:report:u1')).toBe('production:report:u1');
            for (const key of SERVICE_KEYS) {
                expect(stripEnvScope(key)).toBe(key);
            }
        });

        it('envBullPrefix returns BullMQ default and custom prefixes unchanged', () => {
            expect(DEFAULT_BULL_PREFIX).toBe('bull');
            expect(envBullPrefix()).toBe('bull');
            expect(envBullPrefix('moon')).toBe('moon');
        });
    });

    describe('development environment', () => {
        beforeEach(() => {
            setNodeEnv('development');
        });

        it('prefixes keys with the environment namespace', () => {
            expect(envScopedKey('stock-update-queue:u1:shopify')).toBe('development:stock-update-queue:u1:shopify');
            expect(envScopedKey('lock:product:stock:updated:e1')).toBe('development:lock:product:stock:updated:e1');
        });

        it('is idempotent so a writer and a reader cannot end up with different names', () => {
            const once = envScopedKey('stock-update-queue:u1:shopify');
            expect(envScopedKey(once)).toBe(once);
            expect(envScopedPattern(envScopedPattern('stock-update-queue:*'))).toBe('development:stock-update-queue:*');
            expect(envBullPrefix(envBullPrefix())).toBe('development-bull');
        });

        it("treats another environment's namespace as part of the key", () => {
            expect(envScopedKey('test:foo')).toBe('development:test:foo');
            expect(stripEnvScope('test:foo')).toBe('test:foo');
        });

        it('SCAN pattern only matches keys of its own environment in a shared keyspace', () => {
            const sharedKeyspace = [
                'stock-update-queue:u1:shopify',            // production
                'development:stock-update-queue:u2:shopify', // development
                'test:stock-update-queue:u3:shopify',        // test
                'development:stock-update-lock:u2'           // development, other mechanism
            ];

            const developmentMatches = sharedKeyspace.filter(key =>
                redisGlobMatches(envScopedPattern('stock-update-queue:*'), key));
            expect(developmentMatches).toEqual(['development:stock-update-queue:u2:shopify']);

            setNodeEnv('production');
            const productionMatches = sharedKeyspace.filter(key =>
                redisGlobMatches(envScopedPattern('stock-update-queue:*'), key));
            expect(productionMatches).toEqual(['stock-update-queue:u1:shopify']);
        });

        it('documents the limit: a production pattern starting with a wildcard still sees other environments', () => {
            setNodeEnv('production');
            expect(redisGlobMatches(envScopedPattern('*stock-update-queue:*'), 'development:stock-update-queue:u2:shopify'))
                .toBe(true);
        });

        it('stripEnvScope reverses envScopedKey for keys returned by SCAN', () => {
            for (const key of SERVICE_KEYS) {
                expect(stripEnvScope(envScopedKey(key))).toBe(key);
            }
            // Parser shape used by catalog stockUpdateBatcher.parseQueueKey
            expect(stripEnvScope('development:stock-update-queue:u2:shopify').startsWith('stock-update-queue:')).toBe(true);
        });

        it('stripEnvScope leaves a key without the own namespace unchanged', () => {
            expect(stripEnvScope('stock-update-queue:u1:shopify')).toBe('stock-update-queue:u1:shopify');
        });

        it('envBullPrefix uses a dash so the prefix never contains a colon', () => {
            expect(envBullPrefix()).toBe('development-bull');
            expect(envBullPrefix('moon')).toBe('development-moon');
            expect(envBullPrefix()).not.toContain(':');
        });
    });

    describe('test environment', () => {
        beforeEach(() => {
            setNodeEnv('test');
        });

        it('gets its own test namespace like any non-production environment', () => {
            expect(envScopedKey('lock:s:e1')).toBe('test:lock:s:e1');
            expect(envScopedPattern('stock-update-queue:*')).toBe('test:stock-update-queue:*');
            expect(stripEnvScope('test:lock:s:e1')).toBe('lock:s:e1');
            expect(envBullPrefix()).toBe('test-bull');
        });
    });

    describe('glob characters in the environment name', () => {
        it('are escaped so the namespace cannot widen the SCAN match', () => {
            setNodeEnv('dev*');
            const pattern = envScopedPattern('stock-update-queue:*');
            expect(pattern).toBe('dev\\*:stock-update-queue:*');
            expect(redisGlobMatches(pattern, 'dev*:stock-update-queue:u1:shopify')).toBe(true);
            expect(redisGlobMatches(pattern, 'devX:stock-update-queue:u1:shopify')).toBe(false);
            expect(redisGlobMatches(pattern, 'stock-update-queue:u1:shopify')).toBe(false);
        });
    });
});
