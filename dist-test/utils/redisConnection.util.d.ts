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
export declare function parseRedisConnectionUrl(raw: string | undefined, env?: NodeJS.ProcessEnv): RedisConnectionConfig;
//# sourceMappingURL=redisConnection.util.d.ts.map