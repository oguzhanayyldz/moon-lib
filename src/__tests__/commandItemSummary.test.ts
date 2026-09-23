import { attachItemSummary, buildItemSummary, isItemSummary } from '../common/constants/command-item-summary';

/**
 * Fixture'lar üretici kodun GERÇEK dönüş şekillerinden kopyalandı (elle uydurma şekil yok):
 * - HB: hepsiburada.integration.ts updatePrices → { ...productService.updatePrices, skippedCount, skipped }
 *   productService: başarılı parti { success, uploadId, itemCount, message }, doğrulama hatası { sku, merchantSku, success:false, error }
 * - Trendyol/N11: parti { success, batchRequestId, itemCount }, kalem hatası { productId|externalId, success:false, error }
 * - Amazon: amazonFeed.service.ts → tek feed satırı { feedId, feedDocumentId, status:'SUBMITTED' } / { status:'FAILED', error }
 */
describe('buildItemSummary', () => {
    it('HB: başarılı parti itemCount ağırlığıyla, doğrulama hatası kalem başına, 0 fiyat skipped', () => {
        const result = {
            success: false,
            results: [
                { sku: 'HB-1', merchantSku: undefined, success: false, error: 'Price must be greater than 0' },
                { success: true, uploadId: 'up-1', itemCount: 3, message: 'Price update submitted successfully.' }
            ],
            skippedCount: 2,
            skipped: [
                { sku: 'HB-8', productId: 'p8', externalId: 'HB-8', reason: 'zero_or_missing_price' },
                { sku: 'HB-9', productId: 'p9', externalId: 'HB-9', reason: 'zero_or_missing_price' }
            ]
        };

        expect(buildItemSummary(result)).toEqual({ total: 6, succeeded: 3, failed: 1, skipped: 2 });
    });

    it('Trendyol/N11: parti çağrısı düşerse kalem başına failed sayılır', () => {
        const result = {
            success: false,
            results: [
                { success: true, batchRequestId: 'b-1', itemCount: 1000 },
                { productId: 'p1', externalId: 'BC-1', success: false, error: 'timeout' },
                { productId: 'p2', externalId: 'BC-2', success: false, error: 'timeout' }
            ]
        };

        expect(buildItemSummary(result)).toEqual({ total: 1002, succeeded: 1000, failed: 2, skipped: 0 });
    });

    it('Amazon: tek feed satırı parti düzeyinde, inputCount kalemin tamamına yayılır', () => {
        const submitted = { success: true, results: [{ feedId: 'f1', feedDocumentId: 'd1', status: 'SUBMITTED' }] };
        const failed = { success: false, results: [{ status: 'FAILED', error: 'Quota exceeded' }] };

        expect(buildItemSummary(submitted, { inputCount: 7 })).toEqual({ total: 7, succeeded: 7, failed: 0, skipped: 0 });
        expect(buildItemSummary(failed, { inputCount: 7 })).toEqual({ total: 7, succeeded: 0, failed: 7, skipped: 0 });
    });

    it('inputCount yokken parti satırı tek birim sayılır (tüketici fallback`ı için güvenli alt sınır)', () => {
        expect(buildItemSummary({ success: true, results: [{ feedId: 'f1', status: 'SUBMITTED' }] }))
            .toEqual({ total: 1, succeeded: 1, failed: 0, skipped: 0 });
    });

    it('geçerli summary varsa aynen döner, geçersizse yeniden hesaplanır', () => {
        const summary = { total: 5, succeeded: 3, failed: 1, skipped: 1 };
        expect(buildItemSummary({ summary, results: [] })).toBe(summary);

        const broken = { summary: { total: 9, succeeded: 1, failed: 0, skipped: 0 }, results: [{ sku: 'a', success: true }] };
        expect(buildItemSummary(broken)).toEqual({ total: 1, succeeded: 1, failed: 0, skipped: 0 });
    });

    it('sayılabilir şekil yoksa undefined (tekil komut / void)', () => {
        expect(buildItemSummary(undefined)).toBeUndefined();
        expect(buildItemSummary({ success: true, data: { id: 1 } })).toBeUndefined();
    });

    it('dizi sonuç (kargo toplu takip) satır satır sayılır', () => {
        expect(buildItemSummary([{ orderCargoId: 'a', success: true }, { orderCargoId: 'b', success: false, error: 'x' }]))
            .toEqual({ total: 2, succeeded: 1, failed: 1, skipped: 0 });
    });

    it('değişmez: total = succeeded + failed + skipped', () => {
        const s = buildItemSummary({ results: [{ sku: 'a', success: true }, { sku: 'b', success: false }], skippedCount: 4 });
        expect(isItemSummary(s)).toBe(true);
    });
});

describe('attachItemSummary', () => {
    it('updatePrices sonucuna summary ekler, mevcut alanları (success, results) korur', () => {
        const result = { success: false, results: [{ sku: 'a', success: false, error: 'x' }, { success: true, itemCount: 2 }] };
        const out = attachItemSummary('updatePrices', { priceUpdates: [{}, {}, {}] }, result);

        expect(out).toEqual({ ...result, summary: { total: 3, succeeded: 2, failed: 1, skipped: 0 } });
        expect(out.success).toBe(false);
        expect(out.results).toBe(result.results);
    });

    it('updateStocks için stockUpdates uzunluğunu inputCount olarak kullanır (Amazon)', () => {
        const out = attachItemSummary('updateStocks', { stockUpdates: [{}, {}] }, { success: true, results: [{ feedId: 'f', status: 'SUBMITTED' }] });
        expect((out as any).summary).toEqual({ total: 2, succeeded: 2, failed: 0, skipped: 0 });
    });

    it('toplu olmayan komut, dizi ya da boş sonuç değişmeden döner', () => {
        const single = { success: true, data: {} };
        expect(attachItemSummary('sendTracking', {}, single)).toBe(single);
        const arr = [{ success: true }];
        expect(attachItemSummary('updatePrices', {}, arr)).toBe(arr);
        expect(attachItemSummary('updatePrices', {}, undefined)).toBeUndefined();
    });
});
