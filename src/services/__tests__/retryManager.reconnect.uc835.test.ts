import { RetryManager } from '../retryManager';
import { redisWrapper } from '../redisWrapper.service';

jest.mock('../redisWrapper.service', () => ({ redisWrapper: { client: undefined } }));

/**
 * UC-835 (F-56): RetryManager Redis istemcisini her çağrıda redisWrapper'dan okur.
 * Servislerin 'end' işleyicisi Redis kopunca redisWrapper.connect() ile YENİ istemci kurar. RetryManager istemciyi
 * kurucuda yakalarsa kapanmış eski istemcide kalır: her deneme sayacı çağrısı fırlar, RetryableListener'ın hata yolu
 * (incrementRetryCount) de fırladığı için hiçbir başarısız olay sayılamaz ve DLQ'ya ulaşamaz.
 */
const fakeClient = (name: string) => {
    const store = new Map<string, string>();
    return {
        name,
        store,
        get: jest.fn(async (key: string) => store.get(key) ?? null),
        set: jest.fn(async (key: string, value: string) => {
            store.set(key, value);
            return 'OK';
        }),
        del: jest.fn(async (key: string) => (store.delete(key) ? 1 : 0))
    };
};

describe('RetryManager — Redis yeniden bağlanması (UC-835)', () => {
    const wrapper = redisWrapper as unknown as { client: ReturnType<typeof fakeClient> };

    it('yeniden bağlanmadan sonra yeni istemciyi kullanır', async () => {
        const closed = fakeClient('closed');
        wrapper.client = closed;
        const manager = new RetryManager();

        const fresh = fakeClient('fresh');
        closed.get.mockRejectedValue(new Error('The client is closed'));
        closed.set.mockRejectedValue(new Error('The client is closed'));
        wrapper.client = fresh;

        expect(await manager.incrementRetryCount('order:created', 'evt-1')).toBe(1);
        expect(await manager.shouldRetry('order:created', 'evt-1')).toBe(true);
        await manager.resetRetryCount('order:created', 'evt-1');
        expect(fresh.set).toHaveBeenCalledTimes(1);
        expect(fresh.del).toHaveBeenCalledTimes(1);
        expect(closed.get).not.toHaveBeenCalled();
    });

    it('kurulurken istemci henüz yoksa ilk çağrıda okur', async () => {
        wrapper.client = undefined as unknown as ReturnType<typeof fakeClient>;
        const manager = new RetryManager();

        const fresh = fakeClient('fresh');
        wrapper.client = fresh;

        expect(await manager.getRetryCount('order:created', 'evt-2')).toBe(0);
        expect(fresh.get).toHaveBeenCalledTimes(1);
    });
});
