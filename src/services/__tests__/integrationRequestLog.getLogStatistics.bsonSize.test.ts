/**
 * TASK-MUDY1MX1YK157 — `getLogStatistics()` boyut aggregation'ı, gövdeler
 * `formatBodyForStorage` ile string olarak saklandığında `$bsonSize requires
 * a document input` hatasıyla patlıyordu (`$cond` yalnız truthiness bakıyor,
 * tip kontrolü yapmıyordu). Düzeltme `$switch` + `$type` ile string/object
 * ayrımını yapıp doğru operatörü ($strLenBytes / $bsonSize) seçiyor.
 *
 * Gerçek bir MongoDB'ye bağlanmadan, `$bsonSize`/`$strLenBytes`'ın gerçek
 * Mongo'daki tip katılığını (yanlış tipte fırlatma) taklit eden minik bir
 * aggregation değerlendiricisi kullanılır — böylece eski `$cond` deseni bu
 * testte de aynı şekilde patlar, yeni `$switch` deseni patlamaz.
 */
import { IntegrationRequestLogService } from '../integrationRequestLog.service';

type Doc = {
    _id: string;
    userId: string;
    integrationName: string;
    requestBody?: any;
    responseBody?: any;
    duration?: number;
    requestTime: Date;
};

function mongoType(v: any): string {
    if (v === undefined) return 'missing';
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    if (typeof v === 'string') return 'string';
    if (typeof v === 'number') return 'double';
    if (typeof v === 'object') return 'object';
    return typeof v;
}

function evalExpr(expr: any, doc: any): any {
    if (typeof expr === 'string' && expr.startsWith('$')) {
        return doc[expr.slice(1)];
    }
    if (Array.isArray(expr)) {
        return expr.map((e) => evalExpr(e, doc));
    }
    if (expr !== null && typeof expr === 'object') {
        const key = Object.keys(expr)[0];
        const val = expr[key];
        switch (key) {
            case '$type':
                return mongoType(evalExpr(val, doc));
            case '$eq': {
                const [a, b] = evalExpr(val, doc);
                return a === b;
            }
            case '$in': {
                const [needle, arr] = val;
                return evalExpr(arr, doc).includes(evalExpr(needle, doc));
            }
            case '$switch': {
                for (const branch of val.branches) {
                    if (evalExpr(branch.case, doc)) return evalExpr(branch.then, doc);
                }
                return evalExpr(val.default, doc);
            }
            case '$cond': {
                const [cond, thenExpr, elseExpr] = val;
                return evalExpr(cond, doc) ? evalExpr(thenExpr, doc) : evalExpr(elseExpr, doc);
            }
            case '$bsonSize': {
                const v = evalExpr(val, doc);
                if (v === null || typeof v !== 'object') {
                    throw new Error('$bsonSize requires a document input');
                }
                return Buffer.byteLength(JSON.stringify(v), 'utf8') + 5;
            }
            case '$strLenBytes': {
                const v = evalExpr(val, doc);
                if (typeof v !== 'string') {
                    throw new Error('$strLenBytes requires a string argument');
                }
                return Buffer.byteLength(v, 'utf8');
            }
            case '$add':
                return val.map((e: any) => evalExpr(e, doc)).reduce((a: number, b: number) => a + b, 0);
            default:
                throw new Error(`fake aggregation: desteklenmeyen operator ${key}`);
        }
    }
    return expr;
}

function matchesQuery(doc: any, query: any): boolean {
    for (const field of Object.keys(query)) {
        const cond = query[field];
        const value = doc[field];
        if (cond && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
            if ('$exists' in cond && (value !== undefined) !== cond.$exists) return false;
            if ('$ne' in cond && value === cond.$ne) return false;
            if ('$gte' in cond && !(value >= cond.$gte)) return false;
            continue;
        }
        if (value !== cond) return false;
    }
    return true;
}

/** getLogStatistics()'in kullandığı aggregate/countDocuments/findOne uçlarının sahtesi. */
function createFakeConnection(docs: Doc[]) {
    const FakeModel = {
        countDocuments(query: any) {
            return Promise.resolve(docs.filter((d) => matchesQuery(d, query)).length);
        },
        aggregate(pipeline: any[]) {
            let rows: any[] = docs;
            for (const stage of pipeline) {
                if (stage.$match) {
                    rows = rows.filter((d) => matchesQuery(d, stage.$match));
                } else if (stage.$project) {
                    rows = rows.map((d) => {
                        const projected: any = {};
                        for (const key of Object.keys(stage.$project)) {
                            projected[key] = evalExpr(stage.$project[key], d);
                        }
                        return projected;
                    });
                } else if (stage.$group) {
                    const groups = new Map<any, any[]>();
                    const idExpr = stage.$group._id;
                    for (const d of rows) {
                        const id = idExpr === null ? null : evalExpr(idExpr, d);
                        if (!groups.has(id)) groups.set(id, []);
                        groups.get(id)!.push(d);
                    }
                    const out: any[] = [];
                    for (const [id, groupRows] of groups) {
                        const acc: any = { _id: id };
                        for (const key of Object.keys(stage.$group)) {
                            if (key === '_id') continue;
                            const accExpr = stage.$group[key];
                            const accKey = Object.keys(accExpr)[0];
                            if (accKey === '$sum') {
                                const arg = accExpr.$sum;
                                acc[key] = arg === 1
                                    ? groupRows.length
                                    : groupRows.reduce((sum, r) => sum + evalExpr(arg, r), 0);
                            } else if (accKey === '$avg') {
                                const vals = groupRows.map((r) => evalExpr(accExpr.$avg, r));
                                acc[key] = vals.reduce((a, b) => a + b, 0) / vals.length;
                            }
                        }
                        out.push(acc);
                    }
                    rows = out;
                }
            }
            return Promise.resolve(rows);
        },
        findOne(query: any) {
            const matched = docs.filter((d) => matchesQuery(d, query));
            const builder = {
                sort() {
                    return builder;
                },
                lean() {
                    return Promise.resolve(matched[0] ?? null);
                }
            };
            return builder;
        }
    };

    return {
        model: () => FakeModel
    } as unknown as import('mongoose').Connection;
}

describe('IntegrationRequestLogService.getLogStatistics — $bsonSize tip güvenliği', () => {
    it('eski (object) ve yeni (string) formatta requestBody/responseBody karışık iken hata fırlatmadan boyut hesaplar', async () => {
        const docs: Doc[] = [
            {
                _id: 'old-1',
                userId: 'u1',
                integrationName: 'trendyol',
                requestBody: { sku: 'ABC' },
                responseBody: { status: 'ok' },
                requestTime: new Date('2026-01-01')
            },
            {
                _id: 'new-1',
                userId: 'u1',
                integrationName: 'trendyol',
                requestBody: JSON.stringify({ sku: 'DEF' }, null, 2),
                responseBody: JSON.stringify({ status: 'ok' }, null, 2),
                duration: 120,
                requestTime: new Date('2026-01-02')
            }
        ];

        const service = new IntegrationRequestLogService(createFakeConnection(docs));

        const stats = await service.getLogStatistics('u1');

        expect(stats.totalLogs).toBe(2);
        expect(stats.totalSize).toBeGreaterThan(0);
        expect(stats.sizeEstimateKB).toBeGreaterThanOrEqual(0);
    });

    it('yalnız string gövdeli (yeni format) kayıtlarda da $bsonSize requires a document input fırlatmaz', async () => {
        const docs: Doc[] = [
            {
                _id: 'new-only-1',
                userId: 'u2',
                integrationName: 'hepsiburada',
                requestBody: JSON.stringify({ sku: 'XYZ' }),
                responseBody: JSON.stringify({ ok: true }),
                requestTime: new Date()
            }
        ];

        const service = new IntegrationRequestLogService(createFakeConnection(docs));

        await expect(service.getLogStatistics('u2')).resolves.toEqual(
            expect.objectContaining({ totalLogs: 1, totalSize: expect.any(Number) })
        );
    });
});
