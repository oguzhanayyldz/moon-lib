import { maskConnectionUriSecret } from './logSafety.util';

const DEFAULT_REDIS_PORT = 6379;
const REDIS_PROTOCOLS = new Set(['redis:', 'rediss:']);

/** REDIS_HOST adresinden çıkarılan bağlantı bilgisi. `url` ve `safeUrl` kimlik taşımaz. */
export interface RedisConnectionConfig {
    host: string;
    port: number;
    db: number;
    username?: string;
    password?: string;
    /** Kimlik bilgisi çıkarılmış adres (createClient'a `username`/`password` ile birlikte verilir). */
    url: string;
    /** Loglanabilir biçim (`redis://user:****@host:port`). */
    safeUrl: string;
}

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
export function parseRedisConnectionUrl(
    raw: string | undefined,
    env: NodeJS.ProcessEnv = process.env
): RedisConnectionConfig {
    if (!raw || raw.trim() === '') {
        throw new TypeError('REDIS_HOST is not set');
    }
    const invalid = () => {
        const error = new TypeError(`REDIS_HOST is not a valid URL: ${maskConnectionUriSecret(raw)}`) as TypeError & { code?: string };
        error.code = 'ERR_INVALID_REDIS_URL';
        return error;
    };
    let parsed: URL;
    try {
        parsed = new URL(raw);
    } catch {
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
        safeUrl: maskConnectionUriSecret(raw) as string
    };
}
