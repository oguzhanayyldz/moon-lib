/**
 * UC-979 — Entegrasyon log saklama politikası: sınıflandırma, saklama süresi, başarılı okuma özeti,
 * gelişmiş arama kimlik listesi ve kişisel veri maskesi.
 */
import {
    isReadOperation,
    isSuccessfulLogOutcome,
    computeLogExpireAt,
    measureBodyBytes,
    summarizeReadResponse,
    extractLogSearchKeys,
    buildSearchKeysQuery,
    INTEGRATION_LOG_SUCCESS_RETENTION_SECONDS,
    INTEGRATION_LOG_FAILURE_RETENTION_SECONDS,
    INTEGRATION_LOG_SUMMARY_MAX_IDS,
    INTEGRATION_LOG_SEARCH_KEYS_MAX
} from '../utils/integrationRequestLogPolicy.util';
import { redactPersonalData, redactPersonalDataText, PERSONAL_DATA_MASK, REDACTED_FIELD_MASK } from '../utils/logSafety.util';
import { OperationType } from '../enums/operation-type.enum';
import { ResourceName } from '../common';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('isReadOperation (UC-979 sınıflandırma)', () => {
    it.each([
        OperationType.FETCH_ORDERS,
        OperationType.FETCH_CLAIMS,
        OperationType.READ,
        OperationType.GET_CATEGORIES,
        OperationType.CHECK_STOCK,
        OperationType.HEALTH_CHECK
    ])('%s okumadır', (op) => {
        expect(isReadOperation(op)).toBe(true);
    });

    it.each([
        OperationType.SEND_PRODUCTS,
        OperationType.UPDATE_PRICES,
        OperationType.GET_BATCH_STATUS,
        'OTHER',
        'BILINMEYEN_TUR',
        undefined,
        null
    ])('%s yazma sayılır (tam gövde saklanır)', (op) => {
        expect(isReadOperation(op as any)).toBe(false);
    });
});

describe('isSuccessfulLogOutcome', () => {
    it('2xx + hata yok = başarı', () => {
        expect(isSuccessfulLogOutcome({ responseStatus: 200 })).toBe(true);
        expect(isSuccessfulLogOutcome({ responseStatus: 204, interpretedSuccess: true })).toBe(true);
        expect(isSuccessfulLogOutcome({ responseStatus: 299 })).toBe(true);
    });

    it.each([
        ['≥400', { responseStatus: 400 }],
        ['500', { responseStatus: 500 }],
        ['409 (idempotent de olsa)', { responseStatus: 409 }],
        ['3xx', { responseStatus: 302 }],
        ['199', { responseStatus: 199 }],
        ['207 kısmi', { responseStatus: 207 }],
        ['yorumlayıcı success:false', { responseStatus: 200, interpretedSuccess: false }],
        ['WAF', { responseStatus: 200, blocked: true }],
        ['hata mesajı', { responseStatus: 200, errorMessage: 'timeout' }],
        ['durum kodu yok', { responseStatus: undefined }]
    ])('%s hata sayılır', (_label, input) => {
        expect(isSuccessfulLogOutcome(input as any)).toBe(false);
    });
});

describe('computeLogExpireAt', () => {
    const base = new Date('2026-10-23T10:00:00.000Z');

    it('başarıda 3 gün, hatada 14 gün', () => {
        expect(INTEGRATION_LOG_SUCCESS_RETENTION_SECONDS).toBe(3 * 24 * 3600);
        expect(INTEGRATION_LOG_FAILURE_RETENTION_SECONDS).toBe(14 * 24 * 3600);
        expect(computeLogExpireAt(base, true).getTime() - base.getTime()).toBe(3 * DAY_MS);
        expect(computeLogExpireAt(base, false).getTime() - base.getTime()).toBe(14 * DAY_MS);
    });

    it('tabanı değiştirmez', () => {
        computeLogExpireAt(base, true);
        expect(base.toISOString()).toBe('2026-10-23T10:00:00.000Z');
    });
});

describe('measureBodyBytes', () => {
    it('metin UTF-8 bayt, nesne compact JSON baytı, boş 0', () => {
        expect(measureBodyBytes('ğ')).toBe(2);
        expect(measureBodyBytes({ a: 1 })).toBe(7);
        expect(measureBodyBytes(null)).toBe(0);
        expect(measureBodyBytes(undefined)).toBe(0);
    });
});

describe('summarizeReadResponse', () => {
    it('Trendyol: sayfa bilgisi + sipariş no, paket id ve satır barkodları', () => {
        const body = {
            page: 0, size: 2, totalPages: 5, totalElements: 9,
            content: [
                { orderNumber: 'TY-1', id: 111, customerFirstName: 'Ad', lines: [{ barcode: 'B-1' }, { barcode: 'B-2' }] },
                { orderNumber: 'TY-2', id: 222, lines: [{ barcode: 'B-1' }] }
            ]
        };
        const summary = summarizeReadResponse(ResourceName.Trendyol, body, 1234);
        expect(summary).toEqual({
            omitted: true, reason: 'successful-read', bytes: 1234,
            recordCount: 2, page: 0, size: 2, totalPages: 5, totalElements: 9,
            ids: ['TY-1', '111', 'B-1', 'B-2', 'TY-2', '222'],
            idsTruncated: false
        });
        // Özet kişisel veri taşımaz
        expect(JSON.stringify(summary)).not.toContain('Ad"');
    });

    it('N11: totalPages yoksa pageCount; id null olabilir', () => {
        const body = { page: 1, size: 50, pageCount: 3, content: [{ orderNumber: 'N-1', id: null, customerEmail: 'x@ornek.test' }] };
        const summary = summarizeReadResponse(ResourceName.N11, body, 10);
        expect(summary.totalPages).toBe(3);
        expect(summary.page).toBe(1);
        expect(summary.ids).toEqual(['N-1']);
        expect(summary.totalElements).toBeUndefined();
    });

    it('İdefix: data.items + data.pageCount', () => {
        const body = { data: { items: [{ id: 'S-1', orderNumber: 'I-1', customerContactName: 'Ad Soyad' }], pageCount: 4, totalCount: 7 } };
        const summary = summarizeReadResponse(ResourceName.Idefix, body, 10);
        expect(summary.recordCount).toBe(1);
        expect(summary.totalPages).toBe(4);
        expect(summary.totalElements).toBe(7);
        expect(summary.ids).toEqual(['I-1', 'S-1']);
    });

    it('platform çıkarıcısı liste bulamazsa genel yedeğe düşer', () => {
        const body = { orders: [{ orderNumber: 'X-1' }] };
        const summary = summarizeReadResponse(ResourceName.Trendyol, body, 5);
        expect(summary.recordCount).toBe(1);
        expect(summary.ids).toEqual(['X-1']);
    });

    it('bilinmeyen platformda kök dizi; metin JSON gövde ayrıştırılır', () => {
        const summary = summarizeReadResponse('Bilinmeyen', JSON.stringify([{ barcode: 'K-1' }, { barcode: 'K-2' }]), 5);
        expect(summary.recordCount).toBe(2);
        expect(summary.ids).toEqual(['K-1', 'K-2']);
    });

    it('JSON olmayan gövdede kayıt sayısı ve kimlik yok, bayt korunur', () => {
        const summary = summarizeReadResponse(ResourceName.Trendyol, '<html>ok</html>', 15);
        expect(summary).toEqual({ omitted: true, reason: 'successful-read', bytes: 15, ids: [], idsTruncated: false });
    });

    it(`kimlik listesi ilk ${INTEGRATION_LOG_SUMMARY_MAX_IDS} ile sınırlı ve kesildiği işaretlenir`, () => {
        const content = Array.from({ length: 300 }, (_, i) => ({ orderNumber: `O-${i}` }));
        const summary = summarizeReadResponse(ResourceName.Trendyol, { content }, 1);
        expect(summary.ids).toHaveLength(INTEGRATION_LOG_SUMMARY_MAX_IDS);
        expect(summary.ids[0]).toBe('O-0');
        expect(summary.ids[INTEGRATION_LOG_SUMMARY_MAX_IDS - 1]).toBe(`O-${INTEGRATION_LOG_SUMMARY_MAX_IDS - 1}`);
        expect(summary.idsTruncated).toBe(true);
        expect(summary.recordCount).toBe(300);
    });

    it('tam sınırda kesilme işareti yok', () => {
        const content = Array.from({ length: INTEGRATION_LOG_SUMMARY_MAX_IDS }, (_, i) => ({ orderNumber: `O-${i}` }));
        const summary = summarizeReadResponse(ResourceName.Trendyol, { content }, 1);
        expect(summary.idsTruncated).toBe(false);
    });
});

describe('extractLogSearchKeys / buildSearchKeysQuery', () => {
    it('endpoint yolundaki sayısal/UUID parçalar + gövdedeki kimlik alanları; kişisel veri değil', () => {
        const keys = extractLogSearchKeys({
            endpoint: '/integration/sellers/123456/orders/abc?x=99999999',
            requestBody: { items: [{ barcode: 'BRK-1', stockCode: 'STK-1', quantity: 5, email: 'a@ornek.test' }] },
            responseBody: { batchRequestId: 'b0c5e9a4-1111-4222-8333-944445555666' }
        });
        expect(keys).toEqual(['123456', 'BRK-1', 'STK-1', 'b0c5e9a4-1111-4222-8333-944445555666']);
    });

    it('özet kimlikleri önce gelir, tekrar yok', () => {
        expect(extractLogSearchKeys({ summaryIds: ['A', 'B'], responseBody: { orderNumber: 'A' } })).toEqual(['A', 'B']);
    });

    it(`en çok ${INTEGRATION_LOG_SEARCH_KEYS_MAX} kimlik`, () => {
        const requestBody = { items: Array.from({ length: 500 }, (_, i) => ({ barcode: `B-${i}` })) };
        expect(extractLogSearchKeys({ requestBody })).toHaveLength(INTEGRATION_LOG_SEARCH_KEYS_MAX);
    });

    it('sorgu tam eşleşme ve harf varyantları; regex yok', () => {
        expect(buildSearchKeysQuery(' Ab-1 ')).toEqual({ searchKeys: { $in: ['Ab-1', 'AB-1', 'ab-1'] } });
        expect(buildSearchKeysQuery('(')).toEqual({ searchKeys: { $in: ['('] } });
    });
});

describe('redactPersonalData (UC-979 PII alan adı maskesi)', () => {
    it('kartta sayılan alanlar iç içe dahil maskelenir', () => {
        const input = {
            firstName: 'Ad', lastName: 'Soyad', fullName: 'Ad Soyad',
            delivery: { address1: 'Sokak 1', fullAddress: 'Tam adres', city: 'İstanbul', phone: '05000000000' },
            invoice: { gsm: '05000000001', email: 'kisi@ornek.test', identityNumber: '11111111111', taxNumber: '1234567890' },
            lines: [{ barcode: 'B-1', customerName: 'Ad' }],
            orderNumber: 'TY-1'
        };
        const out = redactPersonalData(input);
        expect(out).toEqual({
            firstName: PERSONAL_DATA_MASK, lastName: PERSONAL_DATA_MASK, fullName: PERSONAL_DATA_MASK,
            delivery: { address1: PERSONAL_DATA_MASK, fullAddress: PERSONAL_DATA_MASK, city: 'İstanbul', phone: PERSONAL_DATA_MASK },
            invoice: { gsm: PERSONAL_DATA_MASK, email: PERSONAL_DATA_MASK, identityNumber: PERSONAL_DATA_MASK, taxNumber: PERSONAL_DATA_MASK },
            lines: [{ barcode: 'B-1', customerName: PERSONAL_DATA_MASK }],
            orderNumber: 'TY-1'
        });
        // Girdiyi değiştirmez
        expect(input.firstName).toBe('Ad');
    });

    it('kişisel alan altındaki nesne bütünüyle maskelenir (adres nesnesi)', () => {
        expect(redactPersonalData({ billingAddress: { city: 'Ankara', line: 'x' } })).toEqual({ billingAddress: PERSONAL_DATA_MASK });
    });

    it('boş değerler korunur (alanın boş olduğu bilgisi kaybolmaz)', () => {
        expect(redactPersonalData({ email: null, phone: '', gsm: undefined })).toEqual({ email: null, phone: '', gsm: undefined });
    });

    it('JSON metin yapısal, XML ve JSON-benzeri metin desenle maskelenir', () => {
        expect(JSON.parse(redactPersonalDataText('{"customerEmail":"k@ornek.test","id":5}'))).toEqual({ customerEmail: PERSONAL_DATA_MASK, id: 5 });
        expect(redactPersonalDataText('<Order><Phone>0500</Phone><Id>5</Id></Order>')).toBe(`<Order><Phone>${PERSONAL_DATA_MASK}</Phone><Id>5</Id></Order>`);
        expect(redactPersonalDataText('kirik {"email":"k@ornek.test", "id":')).not.toContain('k@ornek.test');
    });

    it('kişisel alan yoksa metin aynen döner (biçim bozulmaz)', () => {
        const text = '{ "id": 5,  "barcode": "B" }';
        expect(redactPersonalDataText(text)).toBe(text);
    });

    it('sır maskesiyle karışmaz: ayrı işaret', () => {
        expect(PERSONAL_DATA_MASK).not.toBe(REDACTED_FIELD_MASK);
    });
});
