import { redisWrapper } from '../services/redisWrapper.service';
import { logger } from '../services/logger.service';

/**
 * Kilidi yalnız değeri bizimkiyse uzatır (UC-1020; kalıp: trendyolCommand.listener.ts UC-927).
 * ARGV[1] boş değilse tam eşleşme ister; boşsa (sahip adı süreçte bilinmiyor) değerin ARGV[2] ile bitmesi yeter.
 * Dönüş: 1 uzatıldı, 0 kilit yok ya da başkasının.
 */
export const LOCK_RENEW_SCRIPT = `
    local v = redis.call("get", KEYS[1])
    if not v then return 0 end
    if ARGV[1] ~= "" then
        if v == ARGV[1] then return redis.call("expire", KEYS[1], ARGV[3]) end
        return 0
    end
    if string.sub(v, -string.len(ARGV[2])) == ARGV[2] then return redis.call("expire", KEYS[1], ARGV[3]) end
    return 0`;

/**
 * RetryableListener olay kilidini işlem sürdükçe sahiplik denetimli olarak yeniler. Döndürülen fonksiyon yenilemeyi durdurur.
 * Kilit artık bizim değilse (düştü ya da başkası aldı) yenileme kendiliğinden durur ve hata loglanır.
 * Yenileme hatası (Redis kesintisi) yenilemeyi durdurmaz, sonraki turda yeniden denenir.
 *
 * İmza orders/reporting/trendyol/parasut kopyalarıyla aynıdır; kopyalar bu fonksiyonla birebir değiştirilebilir.
 * expectedValue boşsa `suffix` ile eşleşir.
 */
export function startLockHeartbeat(
    lockKey: string,
    expectedValue: string,
    suffix: string,
    ttlSec: number,
    intervalMs: number
): () => void {
    let stopped = false;
    const timer = setInterval(async () => {
        if (stopped) return;
        try {
            const renewed = await redisWrapper.client.eval(LOCK_RENEW_SCRIPT, {
                keys: [lockKey],
                arguments: [expectedValue, suffix, String(ttlSec)]
            });
            if (Number(renewed) !== 1 && !stopped) {
                logger.error('[LockHeartbeat] Lock lost during processing, heartbeat stopped', { lockKey });
                stopped = true;
                clearInterval(timer);
            }
        } catch (err) {
            logger.warn('[LockHeartbeat] Lock heartbeat failed, will retry', {
                lockKey,
                error: err instanceof Error ? err.message : String(err)
            });
        }
    }, intervalMs);
    timer.unref?.();
    return () => {
        stopped = true;
        clearInterval(timer);
    };
}
