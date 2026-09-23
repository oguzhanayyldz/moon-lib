import { attachItemSummary, buildItemSummary, countCommandInputUnits, countRequestUnits, isItemSummary, STOCK_FETCH_MODE_SKIP_REASON } from '../common/constants/command-item-summary';

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

    it('updateStocks için varyant grubunu SKU birimiyle sayar', () => {
        const params = { stockUpdates: [{ variants: [{}, {}, {}] }, {}] };
        const out = attachItemSummary('updateStocks', params, { success: true, results: [{ feedId: 'f', status: 'SUBMITTED' }] });
        expect((out as any).summary).toEqual({ total: 4, succeeded: 4, failed: 0, skipped: 0 });
    });

    it('toplu olmayan komut, dizi ya da boş sonuç değişmeden döner', () => {
        const single = { success: true, data: {} };
        expect(attachItemSummary('sendTracking', {}, single)).toBe(single);
        const arr = [{ success: true }];
        expect(attachItemSummary('updatePrices', {}, arr)).toBe(arr);
        expect(attachItemSummary('updatePrices', {}, undefined)).toBeUndefined();
    });
});

/**
 * TASK-MUE9FLN4YFNUD: özet birimi SKU'dur. derin'in ölçüm tablosu (TASK-MUE6PW2SS6Z3D-derin-inceleme.md §2 "Bulgu 1 ölçümü")
 * birebir. Sonuç şekilleri PR #938 amazonFeed.service.ts updatePrices dönüşlerinden kopyalandı:
 * feed kuruldu → { success, results:[{feedId, feedDocumentId, status:'SUBMITTED'}], skippedCount, skipped }
 * hepsi atlandı → { success:true, results:[], skippedCount, skipped }
 */
describe('SKU birimi — Amazon varyant grubu ölçüm tablosu', () => {
    const variant = (price: number) => ({ externalId: `SKU-${price}-${Math.random()}`, price });
    const group = (...prices: number[]) => ({ productId: 'p1', externalId: 'PARENT', price: 100, variants: prices.map(variant) });
    const simple = (price: number) => ({ productId: `s-${price}`, externalId: `S-${price}`, price });
    const zeroSkip = (n: number) => Array.from({ length: n }, (_, i) => ({ productId: 'p1', externalId: `z${i}`, reason: 'zero_or_missing_price' }));
    const feedResult = (skipCount: number) => ({
        success: true,
        results: [{ feedId: 'f1', feedDocumentId: 'd1', status: 'SUBMITTED' }],
        skippedCount: skipCount,
        skipped: zeroSkip(skipCount)
    });
    const noFeedResult = (skipCount: number) => ({ success: true, results: [], skippedCount: skipCount, skipped: zeroSkip(skipCount) });

    it.each([
        ['3 varyant hepsi geçerli (1 ürün)', [group(10, 20, 30)], feedResult(0), { total: 3, succeeded: 3, failed: 0, skipped: 0 }],
        ['3 varyant, 1 sıfır (1 ürün)', [group(10, 20, 0)], feedResult(1), { total: 3, succeeded: 2, failed: 0, skipped: 1 }],
        ['3 varyant, 2 sıfır (1 ürün)', [group(10, 0, 0)], feedResult(2), { total: 3, succeeded: 1, failed: 0, skipped: 2 }],
        ['3 varyant hepsi sıfır (1 ürün)', [group(0, 0, 0)], noFeedResult(3), { total: 3, succeeded: 0, failed: 0, skipped: 3 }],
        ['basit ürün 0 fiyat', [simple(0)], noFeedResult(1), { total: 1, succeeded: 0, failed: 0, skipped: 1 }],
        ['basit 2 ürün, 1 sıfır', [simple(10), simple(0)], feedResult(1), { total: 2, succeeded: 1, failed: 0, skipped: 1 }]
    ])('%s', (_label, priceUpdates, result, expected) => {
        const out = attachItemSummary('updatePrices', { priceUpdates }, result) as any;
        expect(out.summary).toEqual(expected);
        expect(isItemSummary(out.summary)).toBe(true);
    });

    it('feed hatasında gönderilmeye çalışılan SKU\'ların tamamı failed sayılır', () => {
        const failed = { success: false, results: [{ status: 'FAILED', error: 'Quota exceeded' }], skippedCount: 1, skipped: zeroSkip(1) };
        const out = attachItemSummary('updatePrices', { priceUpdates: [group(10, 20, 0)] }, failed) as any;
        expect(out.summary).toEqual({ total: 3, succeeded: 0, failed: 2, skipped: 1 });
    });

    it('boş variants[] tek birimdir: platformun no-pushable-variant kaydı yanındaki gönderilen SKU\'yu yutmaz', () => {
        // 0 sayılsaydı girdi 1 (yalnız basit ürün) - atlanan 1 = 0 gönderildi derdi; basit ürün feed'e gitti
        const priceUpdates = [{ productId: 'p1', externalId: 'PARENT', price: 100, variants: [] }, simple(10)];
        const result = {
            success: true,
            results: [{ feedId: 'f1', feedDocumentId: 'd1', status: 'SUBMITTED' }],
            skippedCount: 1,
            skipped: [{ productId: 'p1', externalId: 'PARENT', reason: 'no-pushable-variant' }]
        };
        const out = attachItemSummary('updatePrices', { priceUpdates }, result) as any;
        expect(out.summary).toEqual({ total: 2, succeeded: 1, failed: 0, skipped: 1 });
    });

    it('platformun geçerli summary\'si SKU sayımıyla ezilmez', () => {
        const summary = { total: 5, succeeded: 4, failed: 0, skipped: 1 };
        const out = attachItemSummary('updatePrices', { priceUpdates: [group(1, 2, 3)] }, { success: true, results: [], summary }) as any;
        expect(out.summary).toBe(summary);
    });
});

describe('countRequestUnits / countCommandInputUnits', () => {
    it('variants dolu dizi → varyant sayısı, yok ya da boş → 1', () => {
        expect(countRequestUnits({ variants: [{}, {}] })).toBe(2);
        expect(countRequestUnits({})).toBe(1);
        expect(countRequestUnits({ variants: [] })).toBe(1);
        expect(countRequestUnits({ variants: 'x' })).toBe(1);
        expect(countRequestUnits(undefined)).toBe(1);
    });

    it('komuta göre priceUpdates / stockUpdates toplanır; toplu değilse ya da dizi yoksa undefined', () => {
        expect(countCommandInputUnits('updatePrices', { priceUpdates: [{ variants: [{}, {}, {}] }, {}], stockUpdates: [{}] })).toBe(4);
        expect(countCommandInputUnits('updateStocks', { priceUpdates: [{}], stockUpdates: [{ variants: [{}, {}] }] })).toBe(2);
        expect(countCommandInputUnits('updatePrices', { priceUpdates: [] })).toBe(0);
        expect(countCommandInputUnits('updatePrices', {})).toBeUndefined();
        expect(countCommandInputUnits('sendTracking', { priceUpdates: [{}] })).toBeUndefined();
    });
});

/**
 * TASK-MUEDJI2X1EFCR (zoe §3.1–§3.3): özet gerçekte gönderilen ya da gönderilemeyen SKU sayısını yansıtır.
 * Şekiller üreticilerden: N11/HB/Trendyol updateStocks boş grup → { success:true, results:[] };
 * döngüsel akış koruması → { success:true, results:[], skipped:[{ reason:'stock-fetch-mode' }] }.
 */
describe('hiçbir şey gönderilmediyse succeeded = 0', () => {
    it('boş results + atlanan kaydı yok: parti başarısı varsayılmaz, gönderilmeyen birim skipped', () => {
        const params = { stockUpdates: [{ productId: 'p1', externalId: 'GROUP-1', variants: [] }] };
        const out = attachItemSummary('updateStocks', params, { success: true, results: [] }) as any;
        expect(out.summary).toEqual({ total: 1, succeeded: 0, failed: 0, skipped: 1 });
    });

    it('boş results + atlananlar girdiden az: kalan birimler de skipped, başarılı sayılmaz', () => {
        const out = buildItemSummary({ success: true, results: [], skippedCount: 1 }, { inputCount: 3 });
        expect(out).toEqual({ total: 3, succeeded: 0, failed: 0, skipped: 3 });
    });

    it('satır düzeyi sonuçta hiçbir satıra düşmeyen birim (stokta boş grup + basit ürün) skipped sayılır', () => {
        const params = { stockUpdates: [{ externalId: 'S-1' }, { externalId: 'GROUP-1', variants: [] }] };
        const result = { success: true, results: [{ success: true, batchRequestId: 'b-1', itemCount: 1 }] };
        expect((attachItemSummary('updateStocks', params, result) as any).summary).toEqual({ total: 2, succeeded: 1, failed: 0, skipped: 1 });
    });

    it('satırlar girdiden fazla sayılırsa skipped uydurulmaz', () => {
        const result = { success: true, results: [{ success: true, itemCount: 5 }] };
        expect(buildItemSummary(result, { inputCount: 3 })).toEqual({ total: 5, succeeded: 5, failed: 0, skipped: 0 });
    });

    it('inputCount yoksa boş results boş özet verir (tüketici fallback`ı)', () => {
        expect(buildItemSummary({ success: true, results: [] })).toEqual({ total: 0, succeeded: 0, failed: 0, skipped: 0 });
    });

    it('döngüsel akış: platform hiçbir SKU göndermez, hepsi stock-fetch-mode ile atlanan', () => {
        const stockUpdates = [{ externalId: 'S-1' }, { externalId: 'V-1', variants: [{ externalId: 'V-1' }, { externalId: 'V-2' }] }];
        const skipped = ['S-1', 'V-1', 'V-2'].map(externalId => ({ externalId, reason: STOCK_FETCH_MODE_SKIP_REASON }));
        const out = attachItemSummary('updateStocks', { stockUpdates }, { success: true, results: [], skippedCount: 3, skipped }) as any;
        expect(out.summary).toEqual({ total: 3, succeeded: 0, failed: 0, skipped: 3 });
    });
});

describe('countCommandInputUnits — aynı SKU bir kez sayılır (Amazon grup içi tekrar, §3.3)', () => {
    it('grup içinde iki kez gelen varyant SKU\'su tek birim; Amazon feed satırı 1 SKU başarılı der', () => {
        const priceUpdates = [{ productId: 'p1', externalId: 'SKU-DUP', variants: [{ externalId: 'SKU-DUP', price: 100 }, { externalId: 'SKU-DUP', price: 200 }] }];
        expect(countCommandInputUnits('updatePrices', { priceUpdates })).toBe(1);
        const out = attachItemSummary('updatePrices', { priceUpdates }, { success: true, results: [{ feedId: 'f1', status: 'SUBMITTED' }], skippedCount: 0, skipped: [] }) as any;
        expect(out.summary).toEqual({ total: 1, succeeded: 1, failed: 0, skipped: 0 });
    });

    it('gruplar ve basit ürün arasında tekrar eden SKU da tek birim', () => {
        const stockUpdates = [{ externalId: 'A' }, { externalId: 'A' }, { variants: [{ externalId: 'A' }, { externalId: 'B' }] }];
        expect(countCommandInputUnits('updateStocks', { stockUpdates })).toBe(2);
    });

    it('externalId\'siz kalem ve boş grup tekilleştirilmez (platform her birini ayrı atlar)', () => {
        const priceUpdates = [{}, {}, { externalId: 'G', variants: [] }, { externalId: 'G', variants: [] }, { variants: [{}, {}] }];
        expect(countCommandInputUnits('updatePrices', { priceUpdates })).toBe(6);
    });
});

