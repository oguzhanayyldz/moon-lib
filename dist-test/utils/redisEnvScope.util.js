"use strict";
/**
 * Environment-scoped Redis names (ENV-ISO, TASK-MU1QNQKCOKD07).
 *
 * WHY:
 * Local skaffold and production share the same Redis server, and most services use
 * the same DB index in both. Redis keys carry no environment, so work written by one
 * environment (queues, locks, BullMQ jobs) is picked up by the other one. Outbox and
 * dead-letter records are already separated by their `environment` field; these
 * helpers give Redis-backed work the same boundary.
 *
 * RULES:
 * 1. The environment source is `REDIS_KEY_ENV || NODE_ENV || 'production'`, read on every
 *    call. An empty value counts as missing. Without `REDIS_KEY_ENV` this is exactly the
 *    outbox source (`outbox.schema.ts`, `eventPublisher.job.ts`).
 * 2. When the resolved environment is `production`, every helper returns its input
 *    unchanged: key names, SCAN patterns and BullMQ prefixes stay byte-for-byte identical,
 *    so a deploy orphans no queued or delayed job.
 * 3. Every other environment (`development`, `test`, ...) gets its own namespace:
 *    `<env>:<key>` for keys and patterns, `<env>-<base>` for BullMQ prefixes.
 * 4. A writer and its reader must both use these helpers. Wrapping only one side
 *    splits them in non-production environments.
 *
 * NODE_ENV IS NOT A DEPLOYMENT FACT: some production deployments run with
 * `NODE_ENV=development` (invoice and shipment, `infra/k8s-single`). Without
 * `REDIS_KEY_ENV=production` those services get the `development:` namespace in
 * production, so their names change on deploy and they share that namespace with local
 * development. `REDIS_KEY_ENV` only moves the Redis boundary; outbox and security code
 * keep reading NODE_ENV.
 *
 * LIMIT: a production SCAN pattern that starts with a wildcard (`*foo*`) still matches
 * other environments' keys. Production patterns must start with a literal segment.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BULL_PREFIX = exports.REDIS_KEY_ENV_VARIABLE = void 0;
exports.getRedisKeyEnvironment = getRedisKeyEnvironment;
exports.isRedisEnvScoped = isRedisEnvScoped;
exports.envScopedKey = envScopedKey;
exports.envScopedPattern = envScopedPattern;
exports.stripEnvScope = stripEnvScope;
exports.envBullPrefix = envBullPrefix;
const PRODUCTION_ENVIRONMENT = 'production';
/** Explicit override for the Redis environment; takes precedence over NODE_ENV. */
exports.REDIS_KEY_ENV_VARIABLE = 'REDIS_KEY_ENV';
/** BullMQ's own default prefix (`queue-base.js`: `Object.assign({ prefix: 'bull' }, opts)`). */
exports.DEFAULT_BULL_PREFIX = 'bull';
const GLOB_SPECIAL_CHARS = /[*?[\]\\]/g;
/**
 * Environment used for Redis names: `REDIS_KEY_ENV`, then `NODE_ENV`, then `production`.
 * `||` on purpose: an empty variable falls through to the next source.
 */
function getRedisKeyEnvironment() {
    return process.env[exports.REDIS_KEY_ENV_VARIABLE] || process.env.NODE_ENV || PRODUCTION_ENVIRONMENT;
}
/** `true` when Redis names get an environment namespace (every resolved environment except production). */
function isRedisEnvScoped() {
    return getRedisKeyEnvironment() !== PRODUCTION_ENVIRONMENT;
}
/**
 * Key for SET/GET/DEL/... calls.
 * production: `key` unchanged · otherwise: `<env>:key`.
 * Idempotent: an already scoped key is returned as is, because wrapping twice would
 * make a writer and a reader disagree on the name.
 */
function envScopedKey(key) {
    const environment = getRedisKeyEnvironment();
    if (environment === PRODUCTION_ENVIRONMENT) {
        return key;
    }
    const prefix = `${environment}:`;
    return key.startsWith(prefix) ? key : `${prefix}${key}`;
}
/**
 * Pattern for SCAN MATCH / KEYS, so a non-production environment only sees its own keys.
 * production: `pattern` unchanged · otherwise: `<env>:pattern`, with glob characters in
 * the environment name escaped so the namespace can never widen the match.
 */
function envScopedPattern(pattern) {
    const environment = getRedisKeyEnvironment();
    if (environment === PRODUCTION_ENVIRONMENT) {
        return pattern;
    }
    const prefix = `${environment.replace(GLOB_SPECIAL_CHARS, '\\$&')}:`;
    return pattern.startsWith(prefix) ? pattern : `${prefix}${pattern}`;
}
/**
 * Reverses `envScopedKey` for keys returned by SCAN/KEYS, so existing parsers that
 * expect the unscoped layout (`startsWith('stock-update-queue:')`) keep working.
 * production: `key` unchanged · otherwise: the own namespace is removed when present.
 */
function stripEnvScope(key) {
    const environment = getRedisKeyEnvironment();
    if (environment === PRODUCTION_ENVIRONMENT) {
        return key;
    }
    const prefix = `${environment}:`;
    return key.startsWith(prefix) ? key.substring(prefix.length) : key;
}
/**
 * `prefix` option for BullMQ Queue, Worker and QueueEvents. All three must get the same value.
 * production: `base` unchanged (default `bull`, BullMQ's default) · otherwise: `<env>-base`.
 * A dash, not a colon: BullMQ builds keys as `<prefix>:<queue>:<type>` and
 * `FlowProducer.getChildren` splits them with `split(':')`, so a colon inside the prefix
 * would break flow lookups. Queue names cannot contain a colon either.
 */
function envBullPrefix(base = exports.DEFAULT_BULL_PREFIX) {
    const environment = getRedisKeyEnvironment();
    if (environment === PRODUCTION_ENVIRONMENT) {
        return base;
    }
    const prefix = `${environment}-`;
    return base.startsWith(prefix) ? base : `${prefix}${base}`;
}
//# sourceMappingURL=redisEnvScope.util.js.map