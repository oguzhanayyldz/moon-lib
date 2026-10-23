/**
 * UC-979 — Saklama politikası servis katmanında: başarılı okumada gövde yerine özet, hata ve yazmada
 * tam (maskeli, 64 KB sınırlı) gövde, sonuca göre `expireAt`, kimlik listesi ve liste projeksiyonu.
 */
import {
    IntegrationRequestLogService,
    INTEGRATION_LOG_LIST_PROJECTION,
    withIntegrationLogSizes
} from '../integrationRequestLog.service';
import { PERSONAL_DATA_MASK } from '../../utils/logSafety.util';
import { OperationType } from '../../enums/operation-type.enum';
import { ResourceName } from '../../common';

const DAY_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIME = new Date('2026-10-23T10:00:00.000Z');

function createFakeConnection(logEntry: any) {
    let capturedUpdate: any = null;
    let capturedInsert: any = null;
    const findCalls: any[][] = [];
    const chain = { sort: () => chain, skip: () => chain, limit: () => chain, lean: () => Promise.resolve([]) };
    class FakeModel {
        id = 'log-new';
        constructor(data: any) { capturedInsert = data; }
        save() { return Promise.resolve(this); }
        static findById(_id: string) { return Promise.resolve(logEntry); }
        static findByIdAndUpdate(_id: string, updateData: any) {
            capturedUpdate = updateData;
            return Promise.resolve(null);
        }
        static find(...args: any[]) { findCalls.push(args); return chain; }
        static countDocuments() { return Promise.resolve(0); }
    }
    return {
        connection: { model: () => FakeModel } as unknown as import('mongoose').Connection,
        getCapturedUpdate: () => capturedUpdate,
        getCapturedInsert: () => capturedInsert,
        findCalls
    };
}

function entry(operationType: OperationType | undefined, integrationName = ResourceName.Trendyol, extra: any = {}) {
    return { id: 'log-1', integrationName, operationType, requestTime: REQUEST_TIME, ...extra };
}

const ordersPage = {
    page: 0, size: 2, totalPages: 1, totalElements: 2,
    content: [
        { orderNumber: 'TY-1', id: 111, customerFirstName: 'Ad', customerEmail: 'kisi@ornek.test', lines: [{ barcode: 'B-1' }] },
        { orderNumber: 'TY-2', id: 222, shipmentAddress: { fullAddress: 'Tam adres' }, lines: [{ barcode: 'B-2' }] }
    ]
};

describe('logResponse — başarılı okuma (UC-979)', () => {
    it('gövde saklanmaz; özet, 3 günlük expireAt ve kimlik listesi yazılır', async () => {
        const { connection, getCapturedUpdate } = createFakeConnection(entry(OperationType.FETCH_ORDERS, ResourceName.Trendyol, { searchKeys: ['123456'] }));
        await new IntegrationRequestLogService(connection).logResponse('log-1', { responseStatus: 200, responseBody: ordersPage, duration: 42 });

        const update = getCapturedUpdate();
        expect(update.responseBody).toBeNull();
        expect(update.responseSummary).toMatchObject({
            omitted: true, reason: 'successful-read', recordCount: 2, page: 0, totalElements: 2,
            ids: ['TY-1', '111', 'B-1', 'TY-2', '222', 'B-2'], idsTruncated: false
        });
        expect(update.responseSummary.bytes).toBe(Buffer.byteLength(JSON.stringify(ordersPage), 'utf8'));
        expect(update.responseBytes).toBe(update.responseSummary.bytes);
        expect(update.duration).toBe(42);
        expect(update.responseStatus).toBe(200);
        expect(update.expireAt.getTime() - REQUEST_TIME.getTime()).toBe(3 * DAY_MS);
        // istek anındaki kimlikler korunur, özet kimlikleri eklenir
        expect(update.searchKeys).toEqual(['123456', 'TY-1', '111', 'B-1', 'TY-2', '222', 'B-2']);
        // kişisel veri hiçbir alanda kalmaz
        expect(JSON.stringify(update)).not.toContain('kisi@ornek.test');
        expect(JSON.stringify(update)).not.toContain('Tam adres');
    });

    it('N11 ve İdefix sayfa yapısı da özetlenir', async () => {
        const n11 = createFakeConnection(entry(OperationType.FETCH_ORDERS, ResourceName.N11));
        await new IntegrationRequestLogService(n11.connection).logResponse('log-1', {
            responseStatus: 200, responseBody: { page: 0, size: 1, pageCount: 2, content: [{ orderNumber: 'N-1', id: null }] }
        });
        expect(n11.getCapturedUpdate().responseSummary).toMatchObject({ recordCount: 1, totalPages: 2, ids: ['N-1'] });

        const idefix = createFakeConnection(entry(OperationType.FETCH_ORDERS, ResourceName.Idefix));
        await new IntegrationRequestLogService(idefix.connection).logResponse('log-1', {
            responseStatus: 200, responseBody: { items: [{ id: 'S-1', orderNumber: 'I-1' }], pageCount: 3 }
        });
        expect(idefix.getCapturedUpdate().responseSummary).toMatchObject({ recordCount: 1, totalPages: 3, ids: ['I-1', 'S-1'] });
        expect(idefix.getCapturedUpdate().responseBody).toBeNull();
    });
});

describe('logResponse — hata ve yazma tam gövdeyle saklanır (UC-979)', () => {
    it('hatalı okuma (500): tam gövde maskeli, özet yok, 14 gün', async () => {
        const { connection, getCapturedUpdate } = createFakeConnection(entry(OperationType.FETCH_ORDERS));
        await new IntegrationRequestLogService(connection).logResponse('log-1', { responseStatus: 500, responseBody: ordersPage });

        const update = getCapturedUpdate();
        expect(update.responseSummary).toBeUndefined();
        const stored = JSON.parse(update.responseBody);
        expect(stored.content[0].orderNumber).toBe('TY-1');
        expect(stored.content[0].customerEmail).toBe(PERSONAL_DATA_MASK);
        expect(stored.content[1].shipmentAddress).toBe(PERSONAL_DATA_MASK);
        expect(update.responseBody).not.toContain('\n'); // compact
        expect(update.expireAt.getTime() - REQUEST_TIME.getTime()).toBe(14 * DAY_MS);
        expect(update.searchKeys).toEqual(expect.arrayContaining(['TY-1', 'B-2']));
    });

    it('metin (string) olarak gelen JSON ve XML gövdede de kişisel veri maskelenir', async () => {
        const json = createFakeConnection(entry(OperationType.SEND_PRODUCTS));
        await new IntegrationRequestLogService(json.connection).logResponse('log-1', {
            responseStatus: 400, responseBody: '{"orderNumber":"TY-9","customerEmail":"kisi@ornek.test"}' as any
        });
        expect(JSON.parse(json.getCapturedUpdate().responseBody)).toEqual({ orderNumber: 'TY-9', customerEmail: PERSONAL_DATA_MASK });

        const xml = createFakeConnection(entry(OperationType.SEND_PRODUCTS));
        await new IntegrationRequestLogService(xml.connection).logResponse('log-1', {
            responseStatus: 400, responseBody: '<Err><Gsm>05000000000</Gsm><Code>1</Code></Err>' as any
        });
        expect(xml.getCapturedUpdate().responseBody).toBe(`<Err><Gsm>${PERSONAL_DATA_MASK}</Gsm><Code>1</Code></Err>`);
    });

    it.each([
        ['207 kısmi başarı', { responseStatus: 207 }],
        ['hata mesajlı 200', { responseStatus: 200, errorMessage: 'Zaman aşımı' }]
    ])('okumada %s hata sayılır', async (_label, extra) => {
        const { connection, getCapturedUpdate } = createFakeConnection(entry(OperationType.FETCH_ORDERS));
        await new IntegrationRequestLogService(connection).logResponse('log-1', { responseBody: ordersPage, ...(extra as any) });

        const update = getCapturedUpdate();
        expect(update.responseSummary).toBeUndefined();
        expect(typeof update.responseBody).toBe('string');
        expect(update.expireAt.getTime() - REQUEST_TIME.getTime()).toBe(14 * DAY_MS);
    });

    it('WAF engel sayfası okuma özeti yapılmaz, tam gövde ve deterministik başarısızlık yazılır', async () => {
        const html = '<html><head><title>Attention Required! | Cloudflare</title></head><body>blocked</body></html>';
        const { connection, getCapturedUpdate } = createFakeConnection(entry(OperationType.FETCH_ORDERS));
        await new IntegrationRequestLogService(connection).logResponse('log-1', { responseStatus: 403, responseBody: html as any });

        const update = getCapturedUpdate();
        expect(update.interpretedResponse.success).toBe(false);
        expect(update.responseSummary).toBeUndefined();
        expect(update.responseBody).toContain('Attention Required');
        expect(update.expireAt.getTime() - REQUEST_TIME.getTime()).toBe(14 * DAY_MS);
    });

    it('başarılı yazma: tam gövde saklanır, süre 3 gün', async () => {
        const body = { batchRequestId: 'b0c5e9a4-1111-4222-8333-944445555666' };
        const { connection, getCapturedUpdate } = createFakeConnection(entry(OperationType.SEND_PRODUCTS));
        await new IntegrationRequestLogService(connection).logResponse('log-1', { responseStatus: 200, responseBody: body });

        const update = getCapturedUpdate();
        expect(update.responseSummary).toBeUndefined();
        expect(update.responseBody).toBe(JSON.stringify(body));
        expect(update.expireAt.getTime() - REQUEST_TIME.getTime()).toBe(3 * DAY_MS);
        expect(update.searchKeys).toEqual(['b0c5e9a4-1111-4222-8333-944445555666']);
    });

    it('operasyon türü bilinmeyen başarılı yanıt yazma sayılır (gövde korunur)', async () => {
        const { connection, getCapturedUpdate } = createFakeConnection(entry(undefined));
        await new IntegrationRequestLogService(connection).logResponse('log-1', { responseStatus: 200, responseBody: ordersPage });

        expect(getCapturedUpdate().responseSummary).toBeUndefined();
        expect(typeof getCapturedUpdate().responseBody).toBe('string');
    });

    it('409 + success:true gövdesi idempotent başarı işaretlenir ama hata süresiyle saklanır', async () => {
        const { connection, getCapturedUpdate } = createFakeConnection(entry(OperationType.UPDATE_PRICES));
        await new IntegrationRequestLogService(connection).logResponse('log-1', { responseStatus: 409, responseBody: { success: true } });

        const update = getCapturedUpdate();
        expect(update.idempotentSuccess).toBe(true);
        expect(update.expireAt.getTime() - REQUEST_TIME.getTime()).toBe(14 * DAY_MS);
    });

    it('409 + success:false idempotent sayılmaz', async () => {
        const { connection, getCapturedUpdate } = createFakeConnection(entry(OperationType.UPDATE_PRICES));
        await new IntegrationRequestLogService(connection).logResponse('log-1', { responseStatus: 409, responseBody: '{"success":false}' as any });

        expect(getCapturedUpdate().idempotentSuccess).toBeUndefined();
    });
});

describe('logRequest — kayıt anı alanları (UC-979)', () => {
    it('geçici 14 gün expireAt, istek baytı, kimlik listesi ve PII maskeli compact gövde', async () => {
        const { connection, getCapturedInsert } = createFakeConnection(null);
        const requestBody = { items: [{ barcode: 'BRK-1', quantity: 2 }], receiver: { fullName: 'Ad Soyad', phone: '05000000000' } };
        await new IntegrationRequestLogService(connection).logRequest({
            integrationName: ResourceName.Trendyol,
            userId: 'user-1',
            method: 'POST',
            endpoint: '/sellers/123456/products',
            requestBody,
            operationType: OperationType.SEND_PRODUCTS
        } as any);

        const insert = getCapturedInsert();
        expect(insert.expireAt.getTime() - insert.requestTime.getTime()).toBe(14 * DAY_MS);
        expect(insert.requestBytes).toBe(Buffer.byteLength(JSON.stringify(requestBody), 'utf8'));
        expect(insert.searchKeys).toEqual(['123456', 'BRK-1']);
        expect(JSON.parse(insert.requestBody)).toEqual({ items: [{ barcode: 'BRK-1', quantity: 2 }], receiver: { fullName: PERSONAL_DATA_MASK, phone: PERSONAL_DATA_MASK } });
    });
});

describe('liste ucu projeksiyonu ve boyutlar (UC-979)', () => {
    it('kullanıcı ve admin listeleri gövde/header/searchKeys alanlarını çekmez', async () => {
        const { connection, findCalls } = createFakeConnection(null);
        const service = new IntegrationRequestLogService(connection);
        await service.getUserLogs('user-1', undefined, 1, 10, 'requestTime', 'desc', {});
        await service.getAdminLogs(undefined, 1, 10, 'requestTime', 'desc', {});

        expect(findCalls.length).toBeGreaterThanOrEqual(2);
        for (const call of findCalls) {
            expect(call[1]).toEqual(INTEGRATION_LOG_LIST_PROJECTION);
        }
        expect(INTEGRATION_LOG_LIST_PROJECTION).toEqual({ requestBody: 0, responseBody: 0, requestHeaders: 0, responseHeaders: 0, searchKeys: 0 });
    });

    it('withIntegrationLogSizes bayt alanlarından boyut üretir; eski kayıtta null', () => {
        expect(withIntegrationLogSizes({ _id: 'a', requestBytes: 10, responseBytes: 20 } as any))
            .toMatchObject({ _id: 'a', requestSize: 10, responseSize: 20, totalSize: 30 });
        expect(withIntegrationLogSizes({ _id: 'b' } as any)).toMatchObject({ requestSize: null, responseSize: null, totalSize: null });
    });
});
