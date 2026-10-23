/**
 * UC-962 — İstek loglarında gövde üst sınırı (64 KB).
 *
 * `trendyol.integrationrequestlogs` 47 GB'a çıktı: her sipariş isteğinin tam yanıtı (~1,35 MB,
 * pretty-print JSON; UC-979'dan beri compact) saklanıyordu. Saklanan istek/yanıt gövdesi artık en çok 64 KB (UTF-8 bayt) +
 * `…(kırpıldı, toplam N bayt)` notu; `interpretedResponse` (özet) tam gövdeden hesaplanmaya devam eder.
 */
import { IntegrationRequestLogService, INTEGRATION_LOG_BODY_MAX_BYTES } from '../integrationRequestLog.service';
import { OperationType } from '../../enums/operation-type.enum';
import { ResourceName } from '../../common';

const NOTE_PATTERN = /\n…\(kırpıldı, toplam (\d+) bayt\)$/;

function createFakeConnection(logEntry: any) {
    let capturedUpdate: any = null;
    let capturedInsert: any = null;
    class FakeModel {
        id = 'log-new';
        constructor(data: any) { capturedInsert = data; }
        save() { return Promise.resolve(this); }
        static findById(_id: string) { return Promise.resolve(logEntry); }
        static findByIdAndUpdate(_id: string, updateData: any) {
            capturedUpdate = updateData;
            return Promise.resolve(null);
        }
    }
    return {
        connection: { model: () => FakeModel } as unknown as import('mongoose').Connection,
        getCapturedUpdate: () => capturedUpdate,
        getCapturedInsert: () => capturedInsert
    };
}

function baseEntry(operationType?: OperationType) {
    return { id: 'log-1', integrationName: ResourceName.Trendyol, operationType, requestTime: new Date() };
}

/** Trendyol sipariş yanıtı biçiminde, ~1 MB'lık gövde (gerçek müşteri verisi değil). */
function bigOrdersResponse(orderCount: number) {
    return {
        page: 0,
        size: orderCount,
        totalElements: orderCount,
        content: Array.from({ length: orderCount }, (_, i) => ({
            orderNumber: `TEST-${i}`,
            lines: [{ barcode: `BARKOD-${i}`, quantity: 1, productName: 'Örnek ürün adı '.repeat(10) }],
            cargoProviderName: 'Örnek Kargo Firması '.repeat(5)
        }))
    };
}

describe('IntegrationRequestLogService — gövde üst sınırı (UC-962)', () => {
    it('64 KB üstü yanıt gövdesini kırpar, sona toplam bayt notunu ekler, baş kısmı aynen korur', async () => {
        const body = bigOrdersResponse(1500);
        const fullStored = JSON.stringify(body); // UC-979: compact JSON
        const fullBytes = Buffer.byteLength(fullStored, 'utf8');
        expect(fullBytes).toBeGreaterThan(500 * 1024);

        const { connection, getCapturedUpdate } = createFakeConnection(baseEntry());
        await new IntegrationRequestLogService(connection).logResponse('log-1', { responseStatus: 200, responseBody: body });

        const stored: string = getCapturedUpdate().responseBody;
        const match = stored.match(NOTE_PATTERN);
        expect(match).not.toBeNull();
        expect(Number(match![1])).toBe(fullBytes);

        const head = stored.replace(NOTE_PATTERN, '');
        expect(Buffer.byteLength(head, 'utf8')).toBeLessThanOrEqual(INTEGRATION_LOG_BODY_MAX_BYTES);
        expect(Buffer.byteLength(head, 'utf8')).toBeGreaterThan(INTEGRATION_LOG_BODY_MAX_BYTES - 4);
        expect(fullStored.startsWith(head)).toBe(true);
        // Belge boyutu: ~1 MB yerine en çok 64 KB + kısa not
        expect(Buffer.byteLength(stored, 'utf8')).toBeLessThan(INTEGRATION_LOG_BODY_MAX_BYTES + 100);
    });

    it('sınırın altındaki ve tam sınırdaki gövdeye dokunmaz; bir bayt fazlası kırpılır', async () => {
        const exact = 'a'.repeat(INTEGRATION_LOG_BODY_MAX_BYTES);
        const { connection, getCapturedUpdate } = createFakeConnection(baseEntry());
        const service = new IntegrationRequestLogService(connection);

        await service.logResponse('log-1', { responseStatus: 200, responseBody: exact as any });
        expect(getCapturedUpdate().responseBody).toBe(exact);

        await service.logResponse('log-1', { responseStatus: 200, responseBody: (exact + 'b') as any });
        expect(getCapturedUpdate().responseBody).toBe(`${exact}\n…(kırpıldı, toplam ${INTEGRATION_LOG_BODY_MAX_BYTES + 1} bayt)`);

        const small = { ok: true, items: [1, 2, 3] };
        await service.logResponse('log-1', { responseStatus: 200, responseBody: small });
        expect(getCapturedUpdate().responseBody).toBe(JSON.stringify(small));
    });

    it('çok baytlı karakteri ortadan bölmez (sınır UTF-8 bayt üzerinden)', async () => {
        // 'ğ' 2 bayt: 1 + 2×N düzeninde kesim noktası bir karakterin ortasına düşer
        const body = 'x' + 'ğ'.repeat(INTEGRATION_LOG_BODY_MAX_BYTES);
        const { connection, getCapturedUpdate } = createFakeConnection(baseEntry());
        await new IntegrationRequestLogService(connection).logResponse('log-1', { responseStatus: 200, responseBody: body as any });

        const head = (getCapturedUpdate().responseBody as string).replace(NOTE_PATTERN, '');
        expect(head).not.toContain('�');
        expect(head).toBe('x' + 'ğ'.repeat((INTEGRATION_LOG_BODY_MAX_BYTES - 1) / 2 | 0));
    });

    it('özet (interpretedResponse) kırpılmamış tam gövdeden hesaplanır', async () => {
        const failedItems = Array.from({ length: 3000 }, (_, i) => ({ barcode: `B-${i}`, failureReasons: ['Örnek red nedeni '.repeat(4)] }));
        const body = { batchRequestId: 'batch-1', status: 'COMPLETED', summary: { total: 5000, success: 2000, failed: 3000 }, successItems: [], failedItems };
        const { connection, getCapturedUpdate } = createFakeConnection(baseEntry(OperationType.GET_BATCH_STATUS));
        await new IntegrationRequestLogService(connection).logResponse('log-1', { responseStatus: 200, responseBody: body });

        const update = getCapturedUpdate();
        expect(update.responseBody).toMatch(NOTE_PATTERN);
        expect(update.interpretedResponse.successCount).toBe(2000);
        expect(update.interpretedResponse.failureCount).toBe(3000);
        expect(update.interpretedResponse.details.total).toBe(5000);
    });

    it('kimlik alanı kırpmadan önce maskelenir; kırpılan gövdede değer kalmaz', async () => {
        const credential = ['cred', 'value', 'uc962'].join('-');
        const body = { apiSecret: credential, filler: 'z'.repeat(INTEGRATION_LOG_BODY_MAX_BYTES * 2) };
        const { connection, getCapturedUpdate } = createFakeConnection(baseEntry());
        await new IntegrationRequestLogService(connection).logResponse('log-1', { responseStatus: 200, responseBody: body });

        const stored: string = getCapturedUpdate().responseBody;
        expect(stored).toMatch(NOTE_PATTERN);
        expect(stored).not.toContain(credential);
        expect(stored).toContain('"apiSecret"');
    });

    it('kesim noktası bir kimlik değerinin ortasına düşse de değerin başı açığa çıkmaz (önce maskele, sonra kırp)', async () => {
        // Compact JSON (UC-979): `{"filler":"` (11 bayt) + filler + `","apiSecret":"` (15 bayt) + değer —
        // ham gövdede 64 KB sınırı değerin 20. baytına düşer; kırpılmış JSON ayrıştırılamaz, değer yarım kalır.
        const credential = ['uc962', 'kesim', 'noktasi', 'degeri', 'abcdefghijklmnop'].join('-');
        const body = { filler: 'z'.repeat(INTEGRATION_LOG_BODY_MAX_BYTES - 11 - 15 - 20), apiSecret: credential };
        expect(Buffer.byteLength(JSON.stringify(body), 'utf8')).toBeGreaterThan(INTEGRATION_LOG_BODY_MAX_BYTES);
        const { connection, getCapturedUpdate } = createFakeConnection(baseEntry());
        await new IntegrationRequestLogService(connection).logResponse('log-1', { responseStatus: 200, responseBody: body });

        const stored: string = getCapturedUpdate().responseBody;
        expect(stored).not.toContain(credential.slice(0, 12));
        expect(stored).toContain('"apiSecret"');
    });

    it('sınıra denk gelen adsız JWT de maskelenir (JWT kuralı tam üç parçalı token ister)', async () => {
        // Uydurma, imzasız demo token — kesilmiş hali JWT kuralına uymaz; bu yüzden maskeleme kırpmadan önce olmalı
        const token = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiJ1Yzk2MiJ9', 'c2lnbmF0dXJlLWRlbW8'].join('.');
        const body = 'z'.repeat(INTEGRATION_LOG_BODY_MAX_BYTES - 30) + ' ' + token + ' son';
        const { connection, getCapturedUpdate } = createFakeConnection(baseEntry());
        await new IntegrationRequestLogService(connection).logResponse('log-1', { responseStatus: 200, responseBody: body as any });

        const stored: string = getCapturedUpdate().responseBody;
        expect(stored).not.toContain(token.slice(0, 25));
    });

    it('istek gövdesi (logRequest) de aynı sınırla saklanır', async () => {
        const body = { items: Array.from({ length: 2000 }, (_, i) => ({ barcode: `B-${i}`, title: 'Ürün başlığı '.repeat(5) })) };
        const { connection, getCapturedInsert } = createFakeConnection(baseEntry());
        await new IntegrationRequestLogService(connection).logRequest({
            integrationName: ResourceName.Trendyol,
            userId: 'user-1',
            method: 'POST',
            endpoint: '/products',
            requestBody: body
        });

        const stored: string = getCapturedInsert().requestBody;
        const match = stored.match(NOTE_PATTERN);
        expect(match).not.toBeNull();
        expect(Number(match![1])).toBe(Buffer.byteLength(JSON.stringify(body), 'utf8'));
        expect(Buffer.byteLength(stored.replace(NOTE_PATTERN, ''), 'utf8')).toBeLessThanOrEqual(INTEGRATION_LOG_BODY_MAX_BYTES);
    });
});
