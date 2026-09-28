/**
 * TASK-MUL54GFH5NS33 — 207 (Multi-Status) toplu gönderim yanıtları artık ne "success" ne
 * "failed" filtresine giriyor; ayrı `success: 'partial'` değeriyle sorgulanıyor. Bu test,
 * `getUserLogs`/`getAdminLogs`'un ürettiği Mongo sorgusunun üç durumu da doğru ayırdığını
 * gerçek bir Mongo'ya bağlanmadan, sorguyu fixture'lara uygulayan sahte bir model ile sınar.
 */
import { IntegrationRequestLogService } from '../integrationRequestLog.service';

type Doc = { _id: string; userId: string; responseStatus?: number; requestTime: Date };

function matchesCondition(value: any, cond: any): boolean {
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
        if ('$gte' in cond && !(value >= cond.$gte)) return false;
        if ('$lt' in cond && !(value < cond.$lt)) return false;
        if ('$lte' in cond && !(value <= cond.$lte)) return false;
        if ('$gt' in cond && !(value > cond.$gt)) return false;
        if ('$ne' in cond && value === cond.$ne) return false;
        if ('$exists' in cond) return cond.$exists ? value !== undefined : value === undefined;
        return true;
    }
    return value === cond;
}

function matchesQuery(doc: any, query: any): boolean {
    for (const key of Object.keys(query)) {
        if (key === '$and') {
            if (!(query.$and as any[]).every((sub) => matchesQuery(doc, sub))) return false;
            continue;
        }
        if (key === '$or') {
            if (!(query.$or as any[]).some((sub) => matchesQuery(doc, sub))) return false;
            continue;
        }
        if (!matchesCondition(doc[key], query[key])) return false;
    }
    return true;
}

function createFakeConnection(docs: Doc[]) {
    class FakeModel {
        static find(query: any) {
            const builder = {
                sort: () => builder,
                skip: () => builder,
                limit: () => builder,
                lean: (): Promise<Doc[]> => Promise.resolve(docs.filter((d) => matchesQuery(d, query)))
            };
            return builder;
        }
        static countDocuments(query: any): Promise<number> {
            return Promise.resolve(docs.filter((d) => matchesQuery(d, query)).length);
        }
    }
    return { model: () => FakeModel } as any;
}

function fixtureDocs(): Doc[] {
    return [
        { _id: 'ok-200', userId: 'u', responseStatus: 200, requestTime: new Date('2026-01-01') },
        { _id: 'partial-207', userId: 'u', responseStatus: 207, requestTime: new Date('2026-01-02') },
        { _id: 'fail-400', userId: 'u', responseStatus: 400, requestTime: new Date('2026-01-03') },
        { _id: 'fail-500', userId: 'u', responseStatus: 500, requestTime: new Date('2026-01-04') },
        { _id: 'no-status', userId: 'u', requestTime: new Date('2026-01-05') }
    ];
}

describe('IntegrationRequestLogService.getUserLogs — 207 ayrı "partial" bucket (TASK-MUL54GFH5NS33)', () => {
    it('success=true artık 207\'yi İÇERMEZ, sadece gerçek 2xx döner', async () => {
        const service = new IntegrationRequestLogService(createFakeConnection(fixtureDocs()));
        const result = await service.getUserLogs('u', undefined, 1, 50, 'requestTime', 'desc', { success: true });
        expect(result.logs.map((l: any) => l._id)).toEqual(['ok-200']);
    });

    it('success="partial" SADECE 207 döner', async () => {
        const service = new IntegrationRequestLogService(createFakeConnection(fixtureDocs()));
        const result = await service.getUserLogs('u', undefined, 1, 50, 'requestTime', 'desc', { success: 'partial' as any });
        expect(result.logs.map((l: any) => l._id)).toEqual(['partial-207']);
    });

    it('success=false 207\'yi hâlâ İÇERMEZ (zaten önceden de içermiyordu)', async () => {
        const service = new IntegrationRequestLogService(createFakeConnection(fixtureDocs()));
        const result = await service.getUserLogs('u', undefined, 1, 50, 'requestTime', 'desc', { success: false });
        expect(result.logs.map((l: any) => l._id).sort()).toEqual(['fail-400', 'fail-500', 'no-status']);
    });
});

describe('IntegrationRequestLogService.getAdminLogs — 207 ayrı "partial" bucket (TASK-MUL54GFH5NS33)', () => {
    it('success=true artık 207\'yi İÇERMEZ', async () => {
        const service = new IntegrationRequestLogService(createFakeConnection(fixtureDocs()));
        const result = await service.getAdminLogs(undefined, 1, 50, 'requestTime', 'desc', { success: true });
        expect(result.logs.map((l: any) => l._id)).toEqual(['ok-200']);
    });

    it('success="partial" SADECE 207 döner', async () => {
        const service = new IntegrationRequestLogService(createFakeConnection(fixtureDocs()));
        const result = await service.getAdminLogs(undefined, 1, 50, 'requestTime', 'desc', { success: 'partial' as any });
        expect(result.logs.map((l: any) => l._id)).toEqual(['partial-207']);
    });
});
