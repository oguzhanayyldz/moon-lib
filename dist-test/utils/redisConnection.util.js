"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRedisConnectionUrl = parseRedisConnectionUrl;
const logSafety_util_1 = require("./logSafety.util");
const DEFAULT_REDIS_PORT = 6379;
const REDIS_PROTOCOLS = new Set(['redis:', 'rediss:']);
/**
 * REDIS_HOST adresini güvenli ayrıştırır (UC-1770).
 *
 * Çıplak `new URL(process.env.REDIS_HOST)` geçersiz girdide `ERR_INVALID_URL` atar ve hata nesnesinin
 * `input` alanı TAM adresi (parola dahil) taşır; `util.inspect`, `JSON.stringify` ya da Node'un
 * yakalanmamış hata dökümü parolayı basar. Bu yardımcı o durumda yalnız maskeli adresi taşıyan bir
 * TypeError atar (`input` alanı yok, ham hata `cause` olarak eklenmez).
 *
 * Parola, ayrı `REDIS_PASSWORD` değişkeni doluysa oradan okunur (adresteki parolayı ezer); böylece
 * REDIS_HOST parolasız tutulabilir ve ortam değişkeni dökümünde kimlik görünmez.
 */
function parseRedisConnectionUrl(raw, env = process.env) {
    if (!raw || raw.trim() === '') {
        throw new TypeError('REDIS_HOST is not set');
    }
    const invalid = () => {
        const error = new TypeError(`REDIS_HOST is not a valid URL: ${(0, logSafety_util_1.maskConnectionUriSecret)(raw)}`);
        error.code = 'ERR_INVALID_REDIS_URL';
        return error;
    };
    let parsed;
    try {
        parsed = new URL(raw);
    }
    catch (_a) {
        throw invalid();
    }
    // Şemasız `user:pass@host` girdisi `user:` şemalı, host'suz bir URL olarak "geçerli" ayrıştırılır.
    if (!REDIS_PROTOCOLS.has(parsed.protocol) || parsed.hostname === '') {
        throw invalid();
    }
    const envPassword = env.REDIS_PASSWORD;
    const password = envPassword && envPassword !== ''
        ? envPassword
        : (parsed.password ? decodeURIComponent(parsed.password) : undefined);
    const username = parsed.username ? decodeURIComponent(parsed.username) : undefined;
    const bare = new URL(parsed.toString());
    bare.username = '';
    bare.password = '';
    const url = bare.toString();
    const dbText = parsed.pathname.replace(/^\//, '');
    const db = Number.parseInt(dbText, 10);
    return {
        host: parsed.hostname,
        port: Number(parsed.port) || DEFAULT_REDIS_PORT,
        db: Number.isInteger(db) && db >= 0 ? db : 0,
        username,
        password,
        url,
        safeUrl: (0, logSafety_util_1.maskConnectionUriSecret)(raw)
    };
}
//# sourceMappingURL=redisConnection.util.js.map