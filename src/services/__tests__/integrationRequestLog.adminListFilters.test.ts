/**
 * UC-800 — admin log listesinde tarih / HTTP kodu / sıralama filtreleri sorguya ulaşmıyordu:
 * `getAdminLogs` bu filtreleri tanımıyordu ve rotalar istemcinin gönderdiği adları (`startDate`,
 * `endDate`, `statusCode`, `sortField`, `sort`) okumuyordu.
 *
 * Sahte model `find`/`sort`/`countDocuments` çağrılarını yakalar; testler Mongo'ya giden sorgu
 * nesnesini doğrudan doğrular.
 */
import { IntegrationRequestLogService, parseAdminLogListParams } from '../integrationRequestLog.service';
import { ResourceName } from '../../common';

function createCapturingConnection() {
    const calls: { findQuery?: any; sort?: any; countQuery?: any } = {};
    class FakeModel {
        static find(query: any) {
            calls.findQuery = query;
            const builder = {
                sort(sortObj: any) { calls.sort = sortObj; return builder; },
                skip() { return builder; },
                limit() { return builder; },
                lean: async () => []
            };
            return builder;
        }
        static async countDocuments(query: any) {
            calls.countQuery = query;
            return 0;
        }
    }
    const connection = {
        models: { IntegrationRequestLog: FakeModel },
        model: () => FakeModel
    } as any;
    return { connection, calls };
}

describe('UC-800 getAdminLogs — tarih / statusCode / sıralama', () => {
    it('tarih aralığı requestTime sorgusuna, statusCode responseStatus eşleşmesine gider', async () => {
        const { connection, calls } = createCapturingConnection();
        const service = new IntegrationRequestLogService(connection);
        const startDate = new Date('2026-10-01T00:00:00.000Z');
        const endDate = new Date('2026-10-07T23:59:59.999Z');

        await service.getAdminLogs(ResourceName.Shopify, 1, 20, 'requestTime', 'desc', {
            startDate,
            endDate,
            statusCode: 429
        });

        expect(calls.findQuery.requestTime).toEqual({ $gte: startDate, $lte: endDate });
        expect(calls.findQuery.$and).toContainEqual({ responseStatus: 429 });
        // Sayım da aynı sorguyla yapılır (sayfalama toplamı filtreli olmalı)
        expect(calls.countQuery).toBe(calls.findQuery);
    });

    it('statusCode ile success birlikte verildiğinde ikisi de korunur (aynı alanı ezmez)', async () => {
        const { connection, calls } = createCapturingConnection();
        const service = new IntegrationRequestLogService(connection);

        await service.getAdminLogs(ResourceName.Shopify, 1, 20, 'requestTime', 'desc', {
            success: true,
            statusCode: 201
        });

        // 2xx (207 hariç) ya da idempotent 409 (UC-569 Ö-4) — $and'de, statusCode ile aynı alanı ezmez
        expect(calls.findQuery.$and).toContainEqual({
            $or: [{ responseStatus: { $gte: 200, $lt: 300, $ne: 207 } }, { idempotentSuccess: true }]
        });
        expect(calls.findQuery.$and).toContainEqual({ responseStatus: 201 });
    });

    it('sıralama yönü uygulanır; indekssiz alan requestTime a düşer', async () => {
        const { connection, calls } = createCapturingConnection();
        const service = new IntegrationRequestLogService(connection);

        await service.getAdminLogs(ResourceName.Shopify, 1, 20, 'requestTime', 'asc', {});
        expect(calls.sort).toEqual({ requestTime: 1 });

        await service.getAdminLogs(ResourceName.Shopify, 1, 20, 'duration', 'desc', {});
        expect(calls.sort).toEqual({ requestTime: -1 });
    });

    it('filtre verilmezse tarih / HTTP kodu koşulu eklenmez', async () => {
        const { connection, calls } = createCapturingConnection();
        const service = new IntegrationRequestLogService(connection);

        await service.getAdminLogs(ResourceName.Shopify, 1, 20, 'requestTime', 'desc', {});

        expect(calls.findQuery).toEqual({ integrationName: ResourceName.Shopify });
    });
});

describe('UC-800 parseAdminLogListParams — tek sözleşme + geriye uyum', () => {
    it('istemci adlarını okur (startDate/endDate/statusCode/sortField/sort)', () => {
        const params = parseAdminLogListParams({
            startDate: '2026-10-01T00:00:00.000Z',
            endDate: '2026-10-07T23:59:59.999Z',
            statusCode: '404',
            sortField: 'requestTime',
            sort: 'asc'
        });

        expect(params).toEqual({
            sortField: 'requestTime',
            sortOrder: 'asc',
            startDate: new Date('2026-10-01T00:00:00.000Z'),
            endDate: new Date('2026-10-07T23:59:59.999Z'),
            statusCode: 404
        });
    });

    it('eski dateFrom/dateTo ve sortOrder adlarını da okur; yeni ad önceliklidir', () => {
        const legacy = parseAdminLogListParams({
            dateFrom: '2026-09-01T00:00:00.000Z',
            dateTo: '2026-09-02T00:00:00.000Z',
            sortOrder: 'asc'
        });
        expect(legacy.startDate).toEqual(new Date('2026-09-01T00:00:00.000Z'));
        expect(legacy.endDate).toEqual(new Date('2026-09-02T00:00:00.000Z'));
        expect(legacy.sortOrder).toBe('asc');

        const both = parseAdminLogListParams({
            startDate: '2026-10-01T00:00:00.000Z',
            dateFrom: '2026-09-01T00:00:00.000Z',
            sort: 'desc',
            sortOrder: 'asc'
        });
        expect(both.startDate).toEqual(new Date('2026-10-01T00:00:00.000Z'));
        expect(both.sortOrder).toBe('desc');
    });

    it('izin listesi dışındaki sıralama alanı ve geçersiz değerler varsayılana düşer', () => {
        const params = parseAdminLogListParams({
            sortField: 'requestBody',
            sort: 'yukarı',
            statusCode: '42',
            startDate: 'dün'
        });

        expect(params).toEqual({
            sortField: 'requestTime',
            sortOrder: 'desc',
            startDate: undefined,
            endDate: undefined,
            statusCode: undefined
        });
    });
});
