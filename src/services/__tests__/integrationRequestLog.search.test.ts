/**
 * TASK-MUD4JK0QBEORE, düzeltme turu 2, Ö-2 — arama değerleri regex'ten kaçırılmadan
 * Mongo `$regex`'e gidiyordu (`advancedSearch=(` / `term=(` 500 döndürüyor, `.` tüm kayıtları
 * eşliyordu). `getUserLogs`/`getAdminLogs` artık `escapeRegExp` ile sarıyor.
 *
 * Gerçek bir MongoDB'ye bağlanmak yerine, `IntegrationRequestLogModel.find/countDocuments`
 * yerine geçen sahte bir model kullanılır; bu model sorgunun `$regex`/`$options` alanlarını
 * gerçek `RegExp` ile derleyip fixture belgelerine uygular. Böylece kaçırılmamış bir değer
 * (`(` gibi) gerçek Mongo'da olduğu gibi bir derleme hatası fırlatır, kaçırılmış bir değer ise
 * yalnız literal eşleşen kaydı döner.
 */
import { IntegrationRequestLogService } from '../integrationRequestLog.service';

type Doc = {
    _id: string;
    userId: string;
    endpoint: string;
    metadata?: { description?: string };
    requestBody?: string;
    responseBody?: string;
    requestTime: Date;
};

function getPath(obj: any, path: string): any {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function matchesCondition(doc: any, field: string, cond: any): boolean {
    const value = getPath(doc, field);
    if (cond && typeof cond === 'object') {
        if ('$regex' in cond) {
            const re = new RegExp(cond.$regex, cond.$options || '');
            return typeof value === 'string' && re.test(value);
        }
        if ('$exists' in cond) {
            return cond.$exists ? value !== undefined : value === undefined;
        }
        if ('$gte' in cond || '$lt' in cond || '$lte' in cond || '$gt' in cond) {
            if (value === undefined) return false;
            if ('$gte' in cond && !(value >= cond.$gte)) return false;
            if ('$lt' in cond && !(value < cond.$lt)) return false;
            if ('$lte' in cond && !(value <= cond.$lte)) return false;
            if ('$gt' in cond && !(value > cond.$gt)) return false;
            return true;
        }
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
        if (!matchesCondition(doc, key, query[key])) return false;
    }
    return true;
}

/** Gerçek Mongo model API'sinin (find().sort().skip().limit().lean() + countDocuments) yerine geçer. */
function createFakeConnection(docs: Doc[]) {
    class FakeModel {
        static find(query: any) {
            let sortField: string | undefined;
            let sortDir = -1;
            let skipN = 0;
            let limitN = Number.POSITIVE_INFINITY;
            const builder = {
                sort(sortObj: Record<string, number>) {
                    const [field, dir] = Object.entries(sortObj)[0];
                    sortField = field;
                    sortDir = dir;
                    return builder;
                },
                skip(n: number) {
                    skipN = n;
                    return builder;
                },
                limit(n: number) {
                    limitN = n;
                    return builder;
                },
                lean(): Promise<Doc[]> {
                    const matched = docs.filter((d) => matchesQuery(d, query));
                    if (sortField) {
                        matched.sort((a, b) => {
                            const av = getPath(a, sortField as string);
                            const bv = getPath(b, sortField as string);
                            return av > bv ? sortDir : av < bv ? -sortDir : 0;
                        });
                    }
                    return Promise.resolve(matched.slice(skipN, skipN + limitN));
                }
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
        { _id: '1', userId: 'user-1', endpoint: '/orders(archived)', metadata: { description: 'ok' }, requestBody: '{}', responseBody: '{}', requestTime: new Date('2026-01-01') },
        { _id: '2', userId: 'user-1', endpoint: '/orders[legacy]', requestBody: '{}', responseBody: '{}', requestTime: new Date('2026-01-02') },
        { _id: '3', userId: 'user-1', endpoint: '/products*sale', requestBody: '{}', responseBody: '{}', requestTime: new Date('2026-01-03') },
        { _id: '4', userId: 'user-1', endpoint: '/cargo/a+b/track', requestBody: '{}', responseBody: '{}', requestTime: new Date('2026-01-04') },
        { _id: '5', userId: 'user-1', endpoint: '/version/1.2.3', requestBody: '{}', responseBody: '{}', requestTime: new Date('2026-01-05') },
        { _id: '6', userId: 'user-1', endpoint: '/plain/no/dot', requestBody: '{}', responseBody: '{}', requestTime: new Date('2026-01-06') },
        // Başka kiracı: aynı literal metni taşıyor, kiracı yalıtımını sınamak için.
        { _id: '7', userId: 'user-2', endpoint: '/orders(archived)', requestBody: '{}', responseBody: '{}', requestTime: new Date('2026-01-07') }
    ];
}

const SPECIAL_CASES: Array<{ term: string; expectedId: string }> = [
    { term: '(', expectedId: '1' },
    { term: '[', expectedId: '2' },
    { term: '*', expectedId: '3' },
    { term: 'a+', expectedId: '4' }
];

describe('IntegrationRequestLogService.getUserLogs — arama değerleri literal kaçırılır (Ö-2)', () => {
    it.each(SPECIAL_CASES)('search="$term" hata vermez ve yalnız literal eşleşeni döner', async ({ term, expectedId }) => {
        const service = new IntegrationRequestLogService(createFakeConnection(fixtureDocs()));

        const result = await service.getUserLogs('user-1', undefined, 1, 50, 'requestTime', 'desc', { search: term });

        expect(result.logs.map((l: any) => l._id)).toEqual([expectedId]);
    });

    it.each(SPECIAL_CASES)('advancedSearch="$term" hata vermez ve yalnız literal eşleşeni döner', async ({ term, expectedId }) => {
        const service = new IntegrationRequestLogService(createFakeConnection(fixtureDocs()));

        const result = await service.getUserLogs('user-1', undefined, 1, 50, 'requestTime', 'desc', { advancedSearch: term });

        expect(result.logs.map((l: any) => l._id)).toEqual([expectedId]);
    });

    it('search="." tüm kayıtları eşlemez, yalnız içinde nokta geçen kaydı döner', async () => {
        const service = new IntegrationRequestLogService(createFakeConnection(fixtureDocs()));

        const result = await service.getUserLogs('user-1', undefined, 1, 50, 'requestTime', 'desc', { search: '.' });

        expect(result.logs.map((l: any) => l._id)).toEqual(['5']);
    });

    it('kiracı yalıtımı bozulmaz: user-1 araması user-2 kaydını döndürmez', async () => {
        const service = new IntegrationRequestLogService(createFakeConnection(fixtureDocs()));

        const result = await service.getUserLogs('user-1', undefined, 1, 50, 'requestTime', 'desc', { search: '(' });

        expect(result.logs.map((l: any) => l.userId)).toEqual(['user-1']);
    });
});

describe('IntegrationRequestLogService.getAdminLogs — arama değerleri literal kaçırılır (Ö-2)', () => {
    // Admin görünümü kiracılar arasında kısıtlanmaz; "(" hem doc 1 (user-1) hem doc 7 (user-2)
    // ile aynı literal endpoint'i taşır, ikisi de dönmeli.
    it.each(SPECIAL_CASES)('search="$term" hata vermez ve yalnız literal eşleşenleri döner', async ({ term, expectedId }) => {
        const service = new IntegrationRequestLogService(createFakeConnection(fixtureDocs()));

        const result = await service.getAdminLogs(undefined, 1, 50, 'requestTime', 'desc', { search: term });

        const expectedIds = term === '(' ? [expectedId, '7'] : [expectedId];
        expect(result.logs.map((l: any) => l._id).sort()).toEqual([...expectedIds].sort());
    });

    it.each(SPECIAL_CASES)('advancedSearch="$term" hata vermez ve yalnız literal eşleşenleri döner', async ({ term, expectedId }) => {
        const service = new IntegrationRequestLogService(createFakeConnection(fixtureDocs()));

        const result = await service.getAdminLogs(undefined, 1, 50, 'requestTime', 'desc', { advancedSearch: term });

        const expectedIds = term === '(' ? [expectedId, '7'] : [expectedId];
        expect(result.logs.map((l: any) => l._id).sort()).toEqual([...expectedIds].sort());
    });

    it('search="." tüm kayıtları eşlemez, yalnız içinde nokta geçen kaydı döner', async () => {
        const service = new IntegrationRequestLogService(createFakeConnection(fixtureDocs()));

        const result = await service.getAdminLogs(undefined, 1, 50, 'requestTime', 'desc', { search: '.' });

        expect(result.logs.map((l: any) => l._id)).toEqual(['5']);
    });
});
