/**
 * RetryableListener.isTransientError — GERÇEK axios hatalarıyla sınıflandırma testi.
 *
 * Neden gerçek axios: hata nesnesi elle kurulunca (`{ status: 404, message: '...' }`)
 * kodun okuduğu alanların gerçekte hangileri olduğu gizlenir. Burada hatalar yerel bir
 * `http.createServer`'a atılan GERÇEK axios isteklerinden doğar; alan yerleşimi
 * (`error.response.status` var, `error.status` axios sürümüne bağlı, `error.code` STRING)
 * üretimdekiyle birebir aynıdır.
 *
 * Altın standart = HTTP sözleşmesi: 4xx (429 hariç) kalıcı, 429 + 5xx + ağ/timeout geçici,
 * iptal edilmiş istek (ERR_CANCELED) kalıcı — çağıran vazgeçmiştir, yeniden denemek yanlış.
 */
import http from 'http';
import { AddressInfo } from 'net';
import axios, { AxiosError } from 'axios';
import { Stan } from 'node-nats-streaming';
import mongoose from 'mongoose';
import { RetryableListener } from '../events/retryableListener';
import { Event, Subjects } from '../common';

jest.mock('../services/redisWrapper.service', () => ({
    redisWrapper: {
        client: { set: jest.fn(), ttl: jest.fn(), eval: jest.fn() }
    }
}));

jest.mock('../services/retryManager', () => ({
    RetryManager: jest.fn().mockImplementation(() => ({
        incrementRetryCount: jest.fn().mockResolvedValue(1),
        resetRetryCount: jest.fn().mockResolvedValue(undefined),
        shouldRetry: jest.fn().mockResolvedValue(true),
    }))
}));

jest.mock('../services/logger.service', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

jest.mock('../metrics/EventMetrics', () => ({
    EventMetrics: {
        eventProcessingDuration: { observe: jest.fn() },
        eventProcessingTotal: { inc: jest.fn() },
        eventRetryTotal: { inc: jest.fn() },
        eventDlqTotal: { inc: jest.fn() },
    }
}));

interface TestEvent extends Event {
    subject: Subjects.UserIntegrationSettings;
    data: { list: Array<{ id: string; user: string }> };
}

class TransientProbeListener extends RetryableListener<TestEvent> {
    subject: Subjects.UserIntegrationSettings = Subjects.UserIntegrationSettings;
    queueGroupName = 'transient-probe-queue-group';

    protected async processEvent(): Promise<void> { /* test kapsamı dışı */ }
    protected getEventId(data: TestEvent['data']): string {
        return `probe-${data.list[0]?.id ?? 'unknown'}`;
    }

    /** protected metodu ölçüme açar */
    public probe(error: unknown): boolean {
        return this.isTransientError(error);
    }
}

/** Tek satırlık ölçüm kaydı — kanıt tablosunun kaynağı */
interface Observation {
    scenario: string;
    'axios .code': string;
    '.response.status': number | string;
    '.status': number | string;
    verdict: 'GECICI' | 'KALICI';
    expected: 'GECICI' | 'KALICI';
    result: 'OK' | 'YANLIS';
}

describe('RetryableListener.isTransientError — gerçek axios hataları', () => {
    let server: http.Server;
    let baseUrl: string;
    let listener: TransientProbeListener;
    const observations: Observation[] = [];

    beforeAll(done => {
        server = http.createServer((req, res) => {
            // /status/<kod> → o kodu döndürür · /slow → yanıtı geciktirir
            const match = /^\/status\/(\d{3})$/.exec(req.url ?? '');
            if (match) {
                res.writeHead(Number(match[1]), { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: `code ${match[1]}` }));
                return;
            }
            if (req.url === '/slow') {
                setTimeout(() => { res.writeHead(200); res.end('{}'); }, 3000).unref();
                return;
            }
            res.writeHead(200); res.end('{}');
        });
        server.listen(0, '127.0.0.1', () => {
            baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
            done();
        });
    });

    afterAll(done => { server.close(() => done()); });

    beforeEach(() => {
        const client = {
            subscribe: jest.fn().mockReturnValue({ on: jest.fn() }),
            subscriptionOptions: jest.fn().mockReturnValue({
                setDeliverAllAvailable: jest.fn().mockReturnThis(),
                setManualAckMode: jest.fn().mockReturnThis(),
                setAckWait: jest.fn().mockReturnThis(),
                setDurableName: jest.fn().mockReturnThis(),
            }),
        } as unknown as Stan;
        const connection = { readyState: 1, model: jest.fn() } as unknown as mongoose.Connection;
        listener = new TransientProbeListener(client, {}, connection);
    });

    /** İsteği koşturur, DOĞAN gerçek hatayı döndürür (hata doğmazsa testi düşürür) */
    const captureError = async (fn: () => Promise<unknown>): Promise<AxiosError> => {
        try {
            await fn();
        } catch (err) {
            return err as AxiosError;
        }
        throw new Error('Beklenen hata doğmadı — vaka geçersiz');
    };

    /** Ölçümü kaydeder ve kararı döndürür */
    const record = (scenario: string, error: AxiosError, expected: 'GECICI' | 'KALICI'): boolean => {
        const isTransient = listener.probe(error);
        const verdict = isTransient ? 'GECICI' : 'KALICI';
        observations.push({
            scenario,
            'axios .code': error.code ?? '(yok)',
            '.response.status': error.response?.status ?? '(yok)',
            '.status': (error as { status?: number }).status ?? '(yok)',
            verdict,
            expected,
            result: verdict === expected ? 'OK' : 'YANLIS',
        });
        return isTransient;
    };

    describe('HTTP 4xx — kalıcı, retry YAPILMAMALI', () => {
        it.each([400, 401, 403, 404, 409, 422])('HTTP %i kalıcı sayılmalı', async code => {
            const error = await captureError(() => axios.get(`${baseUrl}/status/${code}`));
            expect(record(`HTTP ${code}`, error, 'KALICI')).toBe(false);
        });
    });

    describe('HTTP 408/429 ve 5xx — geçici, retry YAPILMALI', () => {
        it.each([408, 429, 500, 502, 503, 504])('HTTP %i geçici sayılmalı', async code => {
            const error = await captureError(() => axios.get(`${baseUrl}/status/${code}`));
            expect(record(`HTTP ${code}`, error, 'GECICI')).toBe(true);
        });
    });

    describe('Ağ katmanı hataları — geçici', () => {
        it('timeout (ECONNABORTED) geçici sayılmalı', async () => {
            const error = await captureError(() => axios.get(`${baseUrl}/slow`, { timeout: 150 }));
            expect(record('timeout', error, 'GECICI')).toBe(true);
        });

        it('ECONNREFUSED geçici sayılmalı', async () => {
            // 1 portu ayrıcalıklı ve dinlenmiyor → bağlantı reddedilir
            const error = await captureError(() => axios.get('http://127.0.0.1:1/', { timeout: 2000 }));
            expect(record('ECONNREFUSED', error, 'GECICI')).toBe(true);
        });
    });

    describe('İptal edilmiş istek — kalıcı, retry YAPILMAMALI', () => {
        it('ERR_CANCELED kalıcı sayılmalı (çağıran vazgeçti)', async () => {
            const controller = new AbortController();
            const request = axios.get(`${baseUrl}/slow`, { signal: controller.signal });
            controller.abort();
            const error = await captureError(() => request);
            expect(record('ERR_CANCELED (abort)', error, 'KALICI')).toBe(false);
        });
    });

    describe('Alan yerleşimi — kodun neyi okuduğu', () => {
        it('axios hatasında HTTP kodu response.status altındadır', async () => {
            const error = await captureError(() => axios.get(`${baseUrl}/status/404`));
            expect(error.response?.status).toBe(404);
            expect((error as { statusCode?: number }).statusCode).toBeUndefined();
            expect(typeof error.code).toBe('string');
            expect(error.code).toBe('ERR_BAD_REQUEST');
        });

        it('string error.code sayısal karşılaştırmaya girmemeli — ERR_CANCELED 2xx sanılmamalı', async () => {
            const controller = new AbortController();
            const request = axios.get(`${baseUrl}/slow`, { signal: controller.signal });
            controller.abort();
            const error = await captureError(() => request);
            expect(error.code).toBe('ERR_CANCELED');
            expect(listener.probe(error)).toBe(false);
        });
    });

    describe('Durum kodu çıkarımı — hangi alan okunur', () => {
        it('yalnız response.status taşıyan hata doğru okunmalı', () => {
            expect(listener.probe({ response: { status: 404 }, message: 'boş' })).toBe(false);
            expect(listener.probe({ response: { status: 503 }, message: 'boş' })).toBe(true);
        });

        it('response.status, statusCode ve status arasında response.status öncelikli', () => {
            // Gerçek axios hatasında yalnız response.status güvenilirdir; çelişkide o kazanmalı
            expect(listener.probe({ response: { status: 404 }, status: 503, message: 'boş' })).toBe(false);
        });

        it('sayı olmayan error.code HTTP kodu sayılmamalı', () => {
            // 'ERR_BAD_REQUEST' eskiden statusCode'a atanıp sayısal karşılaştırmalara giriyordu
            expect(listener.probe({ code: 'ERR_BAD_REQUEST', message: 'boş' })).toBe(false);
        });

        it('MongoDB error.code HTTP kodu sanılmamalı', () => {
            // 11000 HTTP aralığı dışında; 262 (ExceededTimeLimit) aralık İÇİNDE ama HTTP değil.
            // code okunsaydı 262 "3xx" sanılıp desen katmanı hiç çalışmayacaktı.
            expect(listener.probe({ name: 'MongoError', code: 262, message: 'connection timeout to replica' })).toBe(true);
        });

        it('metin biçimli sayısal durum kodu okunmalı', () => {
            expect(listener.probe({ statusCode: '503', message: 'boş' })).toBe(true);
            expect(listener.probe({ statusCode: '404', message: 'boş' })).toBe(false);
        });

        it('HTTP aralığı dışındaki sayı durum kodu sayılmamalı', () => {
            // 11000 kod olarak okunursa hiçbir kurala uymaz; 0 kabul edilip desene düşmeli
            expect(listener.probe({ statusCode: 11000, message: 'connection reset' })).toBe(true);
        });
    });

    describe('Küçük harfe çevrilen mesajda desen eşleşmesi', () => {
        it('ETIMEDOUT geçici sayılmalı (eskiden büyük harfli desen hiç eşleşmiyordu)', () => {
            expect(listener.probe(new Error('connect ETIMEDOUT 10.0.0.5:443'))).toBe(true);
        });

        it('ECONNABORTED geçici sayılmalı', () => {
            expect(listener.probe(new Error('Request ECONNABORTED'))).toBe(true);
        });
    });

    describe('axios dışı hatalar — mevcut davranış korunmalı (regresyon)', () => {
        it('statusCode alanı taşıyan iç hata (ör. CustomError) okunmaya devam etmeli', () => {
            expect(listener.probe({ statusCode: 503, message: 'Service down' })).toBe(true);
            expect(listener.probe({ statusCode: 404, message: 'Not found' })).toBe(false);
            expect(listener.probe({ statusCode: 429, message: 'Slow down' })).toBe(true);
            expect(listener.probe({ statusCode: 409, message: 'Conflict' })).toBe(false);
            expect(listener.probe({ statusCode: 423, message: 'Locked' })).toBe(false);
        });

        it('MongoDB ağ hataları geçici kalmalı', () => {
            expect(listener.probe({ name: 'MongoNetworkError', message: 'socket closed' })).toBe(true);
            expect(listener.probe({ name: 'MongoTimeoutError', message: 'timed out' })).toBe(true);
        });

        it('duplicate key kalıcı kalmalı', () => {
            expect(listener.probe({ name: 'MongoError', code: 11000, message: 'E11000 duplicate key' })).toBe(false);
        });

        it('kod hataları kalıcı kalmalı', () => {
            const err = new TypeError('x is not a function');
            expect(listener.probe(err)).toBe(false);
        });

        it('HTTP kodu olmayan serbest metin ağ hatası geçici kalmalı', () => {
            expect(listener.probe(new Error('connection reset by peer'))).toBe(true);
            expect(listener.probe(new Error('NATS connection timeout'))).toBe(true);
        });

        it('2xx taşıyan nesne kalıcı sayılmalı (hata değil)', () => {
            expect(listener.probe({ statusCode: 200, message: 'OK' })).toBe(false);
        });

        it('hata analizi kendisi patlarsa kalıcı dönmeli (güvenli taraf)', () => {
            const throwingError = { get message() { throw new Error('getter patladı'); } };
            expect(listener.probe(throwingError)).toBe(false);
        });
    });

    describe('Asıl etki — anlık yeniden deneme sayısı', () => {
        /**
         * Sınıflandırma kararının tek tüketicisi `processWithImmediateRetries`:
         * kalıcı hatada döngüyü kırar, geçici hatada `immediateRetries` (varsayılan 3) kez dener.
         * Bu testler kararın DAVRANIŞA yansıdığını gösterir — düzeltme öncesi kalıcı 4xx de
         * 3 kez koşuyordu (100ms + 200ms geri çekilmeyle).
         */
        const countAttempts = async (error: unknown): Promise<number> => {
            let calls = 0;
            (listener as unknown as { processEvent: () => Promise<void> }).processEvent = async () => {
                calls++;
                throw error;
            };
            const span = { setTag: jest.fn(), finish: jest.fn() };
            const msg = { ack: jest.fn() } as unknown as import('node-nats-streaming').Message;
            await expect(
                (listener as unknown as {
                    processWithImmediateRetries: (d: unknown, m: unknown, s: unknown) => Promise<void>;
                }).processWithImmediateRetries({ list: [{ id: 'x', user: 'u' }] }, msg, span)
            ).rejects.toBeDefined();
            return calls;
        };

        it('kalıcı 404 yalnız BİR kez denenmeli', async () => {
            const error = await captureError(() => axios.get(`${baseUrl}/status/404`));
            expect(await countAttempts(error)).toBe(1);
        });

        it('geçici 503 üç kez denenmeli (davranış korundu)', async () => {
            const error = await captureError(() => axios.get(`${baseUrl}/status/503`));
            expect(await countAttempts(error)).toBe(3);
        });

        it('geçici 429 üç kez denenmeli', async () => {
            const error = await captureError(() => axios.get(`${baseUrl}/status/429`));
            expect(await countAttempts(error)).toBe(3);
        });
    });

    afterAll(() => {
        const wrongCount = observations.filter(o => o.result === 'YANLIS').length;
        // eslint-disable-next-line no-console
        console.log('\n=== isTransientError — GERÇEK axios ölçüm tablosu ===');
        // eslint-disable-next-line no-console
        console.table(observations);
        // eslint-disable-next-line no-console
        console.log(`YANLIS SINIFLANDIRMA: ${wrongCount}/${observations.length}\n`);
    });
});
