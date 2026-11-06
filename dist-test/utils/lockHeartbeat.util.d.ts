/**
 * Kilidi yalnız değeri bizimkiyse uzatır (UC-1020; kalıp: trendyolCommand.listener.ts UC-927).
 * ARGV[1] boş değilse tam eşleşme ister; boşsa (sahip adı süreçte bilinmiyor) değerin ARGV[2] ile bitmesi yeter.
 * Dönüş: 1 uzatıldı, 0 kilit yok ya da başkasının.
 */
export declare const LOCK_RENEW_SCRIPT = "\n    local v = redis.call(\"get\", KEYS[1])\n    if not v then return 0 end\n    if ARGV[1] ~= \"\" then\n        if v == ARGV[1] then return redis.call(\"expire\", KEYS[1], ARGV[3]) end\n        return 0\n    end\n    if string.sub(v, -string.len(ARGV[2])) == ARGV[2] then return redis.call(\"expire\", KEYS[1], ARGV[3]) end\n    return 0";
/**
 * RetryableListener olay kilidini işlem sürdükçe sahiplik denetimli olarak yeniler. Döndürülen fonksiyon yenilemeyi durdurur.
 * Kilit artık bizim değilse (düştü ya da başkası aldı) yenileme kendiliğinden durur ve hata loglanır.
 * Yenileme hatası (Redis kesintisi) yenilemeyi durdurmaz, sonraki turda yeniden denenir.
 *
 * İmza orders/reporting/trendyol/parasut kopyalarıyla aynıdır; kopyalar bu fonksiyonla birebir değiştirilebilir.
 * expectedValue boşsa `suffix` ile eşleşir.
 *
 * maxHoldMs > 0 ise (UC-1183) yenileme bu süreden sonra durur ve onMaxHold çağrılır: takılı iş kilidi süresiz yenilemez,
 * kilit TTL'inde düşer ve sonraki yeniden teslim devralır. 0/verilmezse sınır yok (eski davranış).
 */
export declare function startLockHeartbeat(lockKey: string, expectedValue: string, suffix: string, ttlSec: number, intervalMs: number, maxHoldMs?: number, onMaxHold?: () => void): () => void;
//# sourceMappingURL=lockHeartbeat.util.d.ts.map