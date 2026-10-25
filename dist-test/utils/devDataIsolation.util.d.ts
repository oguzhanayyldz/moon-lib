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
/** Connection variables every service reads at startup. */
export declare const DEV_DATA_ISOLATION_VARIABLES: readonly ["MONGO_URI", "REDIS_HOST", "NATS_URL"];
export interface DevDataIsolationViolation {
    variable: string;
    host: string;
}
type EnvLike = Record<string, string | undefined>;
/** `true` when the host can only be a local or in-cluster address (see RULES 2). */
export declare function isLocalDataHost(host: string): boolean;
/**
 * Hosts of a connection string: `scheme://user:pass@h1:p1,h2:p2/path?query`, a bare
 * `host[:port]`, or a comma-separated list of either. Credentials, ports, path and query
 * are dropped; the host after the LAST `@` wins because a password may contain `@`.
 */
export declare function extractConnectionHosts(value: string): string[];
/** `true` when the guard applies to this NODE_ENV (see RULES 1). */
export declare function isDevDataIsolationChecked(env?: EnvLike): boolean;
/** Non-local hosts of a checked process; empty for production and test. */
export declare function findDevDataIsolationViolations(env?: EnvLike): DevDataIsolationViolation[];
/** `VAR=host[,host]` for every configured variable; safe to log (no credentials). */
export declare function describeDevDataTargets(env?: EnvLike): string;
/** Throws when a development process is configured to reach a non-local data host. */
export declare function assertDevDataIsolation(env?: EnvLike): void;
/**
 * Startup entry point for services: logs the data targets of a checked process and exits
 * with code 1 when any of them is not local. No-op for production and test.
 */
export declare function enforceDevDataIsolation(env?: EnvLike): void;
export {};
//# sourceMappingURL=devDataIsolation.util.d.ts.map