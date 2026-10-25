"use strict";
/**
 * Development data isolation guard (UC-1068).
 *
 * WHY:
 * Local skaffold pods run with NODE_ENV=development. Until October 2026 their manifests
 * pointed MONGO_URI and REDIS_HOST at production over the VPN, so development processes
 * wrote outbox/dead-letter records (environment=development) and business data into the
 * production databases. A service calls `enforceDevDataIsolation()` first thing in
 * `start()`; a development process whose data layer is not local refuses to start.
 *
 * RULES:
 * 1. Every NODE_ENV except `production` and `test` is checked, including an unset one:
 *    `pnpm dev` outside skaffold runs without NODE_ENV and must not reach production
 *    either. (Production pods set NODE_ENV=production; yurtici sets nothing and passes
 *    by RULE 3.)
 * 2. A host is local when it is loopback (localhost, 127.0.0.0/8, ::1),
 *    host.docker.internal, a single-label cluster service name (`dev-mongo-srv`) or a
 *    `*.svc` / `*.svc.cluster.local` name. Any IP address or other FQDN is not local.
 * 3. Production pods use single-label service names (`orders-mongodb-srv`,
 *    `dev-redis-srv`, `nats-srv`), so the guard can never stop a production pod, even
 *    one whose NODE_ENV is not `production`.
 * 4. Messages carry the variable name and the host only, never credentials.
 *
 * There is deliberately no override: reaching production data from a development
 * process is the failure this guard exists for.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEV_DATA_ISOLATION_VARIABLES = void 0;
exports.isLocalDataHost = isLocalDataHost;
exports.extractConnectionHosts = extractConnectionHosts;
exports.isDevDataIsolationChecked = isDevDataIsolationChecked;
exports.findDevDataIsolationViolations = findDevDataIsolationViolations;
exports.describeDevDataTargets = describeDevDataTargets;
exports.assertDevDataIsolation = assertDevDataIsolation;
exports.enforceDevDataIsolation = enforceDevDataIsolation;
/** Connection variables every service reads at startup. */
exports.DEV_DATA_ISOLATION_VARIABLES = ['MONGO_URI', 'REDIS_HOST', 'NATS_URL'];
const LOCAL_HOST_NAMES = new Set(['localhost', '::1', 'host.docker.internal']);
const LOOPBACK_IPV4 = /^127(\.\d{1,3}){3}$/;
const CLUSTER_SUFFIXES = ['.svc', '.svc.cluster.local'];
/** `true` when the host can only be a local or in-cluster address (see RULES 2). */
function isLocalDataHost(host) {
    const normalized = host.trim().toLowerCase();
    if (!normalized) {
        return false;
    }
    if (LOCAL_HOST_NAMES.has(normalized) || LOOPBACK_IPV4.test(normalized)) {
        return true;
    }
    if (CLUSTER_SUFFIXES.some(suffix => normalized.endsWith(suffix))) {
        return true;
    }
    // A single-label name has no dot and no colon (an IPv6 literal has colons).
    return !normalized.includes('.') && !normalized.includes(':');
}
/**
 * Hosts of a connection string: `scheme://user:pass@h1:p1,h2:p2/path?query`, a bare
 * `host[:port]`, or a comma-separated list of either. Credentials, ports, path and query
 * are dropped; the host after the LAST `@` wins because a password may contain `@`.
 */
function extractConnectionHosts(value) {
    const hosts = [];
    // `mongodb://u:p@h1:1,h2:2/db` splits into `mongodb://u:p@h1:1` and `h2:2/db`;
    // each piece is reduced to its host the same way.
    for (const entry of value.split(',')) {
        let rest = entry.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split('?')[0];
        const at = rest.lastIndexOf('@');
        if (at !== -1) {
            rest = rest.slice(at + 1);
        }
        rest = rest.split('/')[0];
        const bracketed = rest.match(/^\[([^\]]+)\]/);
        const host = bracketed ? bracketed[1] : rest.split(':')[0];
        if (host) {
            hosts.push(host.toLowerCase());
        }
    }
    return hosts;
}
const UNCHECKED_ENVIRONMENTS = new Set(['production', 'test']);
/** `true` when the guard applies to this NODE_ENV (see RULES 1). */
function isDevDataIsolationChecked(env = process.env) {
    var _a;
    return !UNCHECKED_ENVIRONMENTS.has((_a = env.NODE_ENV) !== null && _a !== void 0 ? _a : '');
}
/** Non-local hosts of a checked process; empty for production and test. */
function findDevDataIsolationViolations(env = process.env) {
    if (!isDevDataIsolationChecked(env)) {
        return [];
    }
    const violations = [];
    for (const variable of exports.DEV_DATA_ISOLATION_VARIABLES) {
        const value = env[variable];
        if (!value) {
            continue;
        }
        for (const host of extractConnectionHosts(value)) {
            if (!isLocalDataHost(host)) {
                violations.push({ variable, host });
            }
        }
    }
    return violations;
}
/** `VAR=host[,host]` for every configured variable; safe to log (no credentials). */
function describeDevDataTargets(env = process.env) {
    return exports.DEV_DATA_ISOLATION_VARIABLES
        .filter(variable => env[variable])
        .map(variable => `${variable}=${extractConnectionHosts(env[variable]).join(',')}`)
        .join(' ');
}
/** Throws when a development process is configured to reach a non-local data host. */
function assertDevDataIsolation(env = process.env) {
    const violations = findDevDataIsolationViolations(env);
    if (violations.length === 0) {
        return;
    }
    const list = violations.map(v => `${v.variable} -> ${v.host}`).join(', ');
    throw new Error(`DEV_DATA_ISOLATION: NODE_ENV=${env.NODE_ENV || '<unset>'} but the data layer is not local (${list}). ` +
        'Local development must use its own MongoDB/Redis/NATS (skaffold dev profile); ' +
        'refusing to start so no development process can read or write production data.');
}
/**
 * Startup entry point for services: logs the data targets of a checked process and exits
 * with code 1 when any of them is not local. No-op for production and test.
 */
function enforceDevDataIsolation(env = process.env) {
    if (!isDevDataIsolationChecked(env)) {
        return;
    }
    try {
        assertDevDataIsolation(env);
    }
    catch (error) {
        console.error(error.message);
        process.exit(1);
    }
    console.log(`DEV_DATA_ISOLATION ok: ${describeDevDataTargets(env)}`);
}
