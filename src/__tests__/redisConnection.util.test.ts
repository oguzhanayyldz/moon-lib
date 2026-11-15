import { inspect } from 'util';
import { parseRedisConnectionUrl } from '../utils/redisConnection.util';

// Sahte değer: her koşuda üretilir, düz metin kimlik kapısına takılmaz (UC-1770).
const FAKE_PASSWORD = `uc1770-${Date.now().toString(36)}`;

const allText = (error: unknown) => [
    inspect(error, { depth: 8, showHidden: true }),
    JSON.stringify(error),
    String((error as Error)?.message),
    String((error as Error)?.stack)
].join('\n');

describe('parseRedisConnectionUrl (UC-1770)', () => {
    it('parolalı adresi ayrıştırır; url ve safeUrl parola taşımaz', () => {
        const config = parseRedisConnectionUrl(`redis://default:${FAKE_PASSWORD}@redis-srv:6380/2`, {});
        expect(config).toMatchObject({ host: 'redis-srv', port: 6380, db: 2, username: 'default', password: FAKE_PASSWORD });
        expect(config.url).toBe('redis://redis-srv:6380/2');
        expect(config.safeUrl).not.toContain(FAKE_PASSWORD);
    });

    it('port ve db yoksa 6379 / 0 kullanır, parola yoksa undefined döner', () => {
        const config = parseRedisConnectionUrl('redis://redis-srv', {});
        expect(config).toMatchObject({ host: 'redis-srv', port: 6379, db: 0, password: undefined, username: undefined });
    });

    it('REDIS_PASSWORD doluysa parolayı oradan alır (adresteki parolayı ezer)', () => {
        expect(parseRedisConnectionUrl('redis://redis-srv:6379', { REDIS_PASSWORD: FAKE_PASSWORD }).password).toBe(FAKE_PASSWORD);
        expect(parseRedisConnectionUrl('redis://:eski@redis-srv:6379', { REDIS_PASSWORD: FAKE_PASSWORD }).password).toBe(FAKE_PASSWORD);
        expect(parseRedisConnectionUrl(`redis://:${FAKE_PASSWORD}@redis-srv`, { REDIS_PASSWORD: '' }).password).toBe(FAKE_PASSWORD);
    });

    it('URL-kodlu parolayı çözer', () => {
        expect(parseRedisConnectionUrl('redis://:a%40b%3Ac@redis-srv', {}).password).toBe('a@b:c');
    });

    it.each([
        ['boşluklu host', `redis://default:${FAKE_PASSWORD}@redis srv:6379`],
        ['kapanmamış IPv6', `redis://default:${FAKE_PASSWORD}@[redis-srv:6379`],
        ['şemasız', `default:${FAKE_PASSWORD}@redis srv:6379`]
    ])('geçersiz adreste (%s) atılan hata hiçbir biçimde parola taşımaz', (_label, raw) => {
        let caught: unknown;
        try {
            parseRedisConnectionUrl(raw, {});
        } catch (error) {
            caught = error;
        }
        expect(caught).toBeInstanceOf(TypeError);
        expect((caught as { code?: string }).code).toBe('ERR_INVALID_REDIS_URL');
        expect((caught as { input?: unknown }).input).toBeUndefined();
        expect(allText(caught)).not.toContain(FAKE_PASSWORD);
    });

    it('boş ya da tanımsız REDIS_HOST için açık hata verir', () => {
        expect(() => parseRedisConnectionUrl(undefined, {})).toThrow('REDIS_HOST is not set');
        expect(() => parseRedisConnectionUrl('  ', {})).toThrow('REDIS_HOST is not set');
    });
});
