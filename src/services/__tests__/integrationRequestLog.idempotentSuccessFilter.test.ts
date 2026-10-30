/**
 * UC-569 Ö-4 — 409 + gövde `success:true` (idempotentSuccess) satırı istemcide "Başarılı" gösterilir;
 * sunucudaki `success` filtresi de aynı satırı başarılı saymalı ("Başarılı=Hayır" filtresi onu listelememeli).
 * Sorgu, fixture'lara uygulanan sahte bir model ile sınanır (bkz. partialStatus207 testi).
 */
import { IntegrationRequestLogService } from '../integrationRequestLog.service';

type Doc = { _id: string; userId: string; responseStatus?: number; idempotentSuccess?: boolean; requestTime: Date };

function matchesCondition(value: any, cond: any): boolean {
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
        if ('$gte' in cond && !(value >= cond.$gte)) return false;
        if ('$lt' in cond && !(value < cond.$lt)) return false;
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

const fixtureDocs = (): Doc[] => [
    { _id: 'ok-200', userId: 'u', responseStatus: 200, requestTime: new Date('2026-01-01') },
    { _id: 'idem-409', userId: 'u', responseStatus: 409, idempotentSuccess: true, requestTime: new Date('2026-01-02') },
    { _id: 'conflict-409', userId: 'u', responseStatus: 409, requestTime: new Date('2026-01-03') },
    { _id: 'fail-500', userId: 'u', responseStatus: 500, requestTime: new Date('2026-01-04') }
];

const ids = (logs: any[]) => logs.map((l) => l._id).sort();

describe.each([
    ['getUserLogs', (s: IntegrationRequestLogService, success: boolean) =>
        s.getUserLogs('u', undefined, 1, 50, 'requestTime', 'desc', { success })],
    ['getAdminLogs', (s: IntegrationRequestLogService, success: boolean) =>
        s.getAdminLogs(undefined, 1, 50, 'requestTime', 'desc', { success })]
])('%s — idempotent 409 başarılı sayılır (UC-569 Ö-4)', (_name, run) => {
    it('success=true: 2xx + idempotent 409; idempotent olmayan 409 hariç', async () => {
        const result: any = await run(new IntegrationRequestLogService(createFakeConnection(fixtureDocs())), true);
        expect(ids(result.logs)).toEqual(['idem-409', 'ok-200']);
    });

    it('success=false: idempotent 409 listelenmez', async () => {
        const result: any = await run(new IntegrationRequestLogService(createFakeConnection(fixtureDocs())), false);
        expect(ids(result.logs)).toEqual(['conflict-409', 'fail-500']);
    });
});
