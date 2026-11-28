/**
 * UC-2619 — ERP stok/fiyat ÇEKME ortak temeli (pazaryeri kalıbı: kaynak başına olay, istek/yanıt fiyat): saf dönüşümler + ErpIntegration somut fetchStocks/fetchPrices/fetchLocations
 * + CredentialsService'in ERP kaynak ayarını süzmesi. Ağ/DB yok: Outbox yazımı `writeOutboxEvent` üzerinden yakalanır.
 */
import { ErpIntegration } from '../common/core/erp-integration';
import {
    buildErpPriceRows,
    buildErpStockRows,
    matchesErpQuery,
    resolveErpBarcode,
    resolveErpStockQuantity,
    roundMoney,
    toVatIncludedPrice
} from '../common/core/erp-catalog.util';
import { ErpCatalogCursor, ErpCatalogItem, ErpCatalogPage } from '../common/interfaces/erp-catalog.interface';
import { Subjects } from '../common/events/subjects';
import { IntegrationType } from '../common/types/integration-type';
import { ResourceName } from '../common/types/resourceName';
import { UNSUPPORTED_COMMAND_RESPONSE } from '../common/constants/integration-commands';
import { CredentialsService } from '../services/credentials.service';

const item = (over: Partial<ErpCatalogItem> = {}): ErpCatalogItem => ({
    erpId: 'e1', sku: 'SKU-1', barcode: '869000', stock: 5, salePrice: 100, salePriceVatIncluded: true, vatRate: 20, ...over
});

describe('erp-catalog.util — B5 barkod yedeği', () => {
    it('barkod doluysa barkod, boş/boşluk/null ise SKU döner', () => {
        expect(resolveErpBarcode({ sku: 'A', barcode: '123' })).toBe('123');
        expect(resolveErpBarcode({ sku: 'A', barcode: '' })).toBe('A');
        expect(resolveErpBarcode({ sku: 'A', barcode: '   ' })).toBe('A');
        expect(resolveErpBarcode({ sku: 'A', barcode: null })).toBe('A');
        expect(resolveErpBarcode({ sku: 'A' })).toBe('A');
    });
});

describe('erp-catalog.util — B6 KDV dönüşümü (ürünün kendi oranı)', () => {
    it('KDV hariç fiyat kendi oranıyla dahile çevrilir', () => {
        expect(toVatIncludedPrice(100, false, 20)).toBe(120);
        expect(toVatIncludedPrice(100, false, 10)).toBe(110);
        expect(toVatIncludedPrice(100, false, 0)).toBe(100);
        expect(toVatIncludedPrice(33.33, false, 1)).toBe(33.66);
    });
    it('KDV dahil fiyata oran uygulanmaz, yalnız yuvarlanır', () => {
        expect(toVatIncludedPrice(120, true, 20)).toBe(120);
        expect(toVatIncludedPrice(10.005, true)).toBe(10.01);
    });
    it('KDV hariç ama oran bilinmiyorsa yazılmaz (null)', () => {
        expect(toVatIncludedPrice(100, false, null)).toBeNull();
        expect(toVatIncludedPrice(100, false, undefined)).toBeNull();
        expect(toVatIncludedPrice(100, false, -5)).toBeNull();
    });
    it('geçersiz/sıfır/negatif fiyat null', () => {
        expect(toVatIncludedPrice(0, true)).toBeNull();
        expect(toVatIncludedPrice(-1, true)).toBeNull();
        expect(toVatIncludedPrice(NaN, true)).toBeNull();
        expect(toVatIncludedPrice(null, true)).toBeNull();
    });
    it('roundMoney kayan nokta kaymasını düzeltir', () => {
        expect(roundMoney(1.005)).toBe(1.01);
    });
});

describe('erp-catalog.util — stok miktarı', () => {
    it('depo seçiliyse yalnız o depo; ERP o depoyu vermiyorsa 0 (ikas/Shopify kalıbı)', () => {
        const i = item({ stock: 9, stockByLocation: [{ locationId: 'D1', quantity: 3 }, { locationId: 'D2', quantity: 6 }] });
        expect(resolveErpStockQuantity(i, 'D2')).toBe(6);
        expect(resolveErpStockQuantity(i, 'D9')).toBe(0);
        expect(resolveErpStockQuantity(i, 'D1')).toBe(3);
        // depo seçili değil → toplam stok
        expect(resolveErpStockQuantity(i, null)).toBe(9);
    });
    it('depo seçili değilse toplam stok; yoksa kırılım toplamı', () => {
        expect(resolveErpStockQuantity(item({ stock: 9 }), null)).toBe(9);
        expect(resolveErpStockQuantity(item({ stock: undefined, stockByLocation: [{ locationId: 'a', quantity: 2 }, { locationId: 'b', quantity: 3 }] }), '')).toBe(5);
    });
    it('UC-2628: negatif stok OLDUĞU GİBİ döner (0\'a kırpma inventory\'de), stok yoksa/geçersizse null', () => {
        expect(resolveErpStockQuantity(item({ stock: -4 }))).toBe(-4);
        expect(resolveErpStockQuantity(item({ stockByLocation: [{ locationId: 'D1', quantity: -3 }] }), 'D1')).toBe(-3);
        expect(resolveErpStockQuantity(item({ stock: NaN }))).toBeNull();
        expect(resolveErpStockQuantity(item({ stock: Infinity }))).toBeNull();
        expect(resolveErpStockQuantity(item({ stock: 0 }))).toBe(0);
        expect(resolveErpStockQuantity(item({ stock: null }))).toBeNull();
    });
});

describe('erp-catalog.util — satır üretimi', () => {
    it('stok satırı: barkod yedeği, hedef depo/raf, SKU\'suz ve stoksuz kalem atlanır', () => {
        const rows = buildErpStockRows([
            item({ sku: 'A', barcode: '' , stock: 2 }),
            item({ sku: '', stock: 7 }),
            item({ sku: 'C', stock: null })
        ], { warehouseId: 'W1', shelfId: 'S1' });
        expect(rows).toEqual([{ sku: 'A', barcode: 'A', quantity: 2, warehouseId: 'W1', shelfId: 'S1' }]);
    });
    it('raf yoksa shelfId alanı hiç yazılmaz', () => {
        const rows = buildErpStockRows([item()], { warehouseId: 'W1', shelfId: null });
        expect(rows[0]).not.toHaveProperty('shelfId');
    });
    it('fiyat satırı: KDV dahile çevrilir, fiyatsız kalem atlanır', () => {
        const rows = buildErpPriceRows([
            item({ sku: 'A', barcode: null, salePrice: 50, salePriceVatIncluded: false, vatRate: 20 }),
            item({ sku: 'B', salePrice: null })
        ], ResourceName.KolayBi);
        expect(rows).toEqual([{ sku: 'A', barcode: 'A', price: 60, source: ResourceName.KolayBi, integrationName: ResourceName.KolayBi }]);
    });
    it('tek ürün süzgeci sku ya da barkodla eşler', () => {
        expect(matchesErpQuery({ sku: 'A', barcode: 'B' }, undefined)).toBe(true);
        expect(matchesErpQuery({ sku: 'A', barcode: 'B' }, { sku: 'A' })).toBe(true);
        expect(matchesErpQuery({ sku: 'A', barcode: 'B' }, { barcode: 'B' })).toBe(true);
        expect(matchesErpQuery({ sku: 'A', barcode: 'B' }, { sku: 'X' })).toBe(false);
        expect(matchesErpQuery({ sku: 'A', barcode: '' }, { barcode: '' })).toBe(true);
    });
});

/** Ağsız test ERP'si: sayfaları bellekten verir, Outbox yazımlarını toplar. */
class FakeErp extends ErpIntegration {
    public written: Array<{ eventType: Subjects; payload: any }> = [];
    public pages: ErpCatalogPage[] = [];
    public calls: Array<ErpCatalogCursor | undefined> = [];
    protected getDefaultCredentials() { return {}; }
    protected validatePlatformCredentials() {}
    protected async connect() {}
    protected async syncProducts() {}
    protected async createInvoice() { return ''; }
    protected async syncContacts() {}
    protected async updateStock() {}
    protected formalizeInvoice = undefined;
    protected updatePrice = undefined;
    protected checkBalance = undefined;
    protected deleteInvoice = undefined;
    protected async listCatalogPage(cursor: ErpCatalogCursor | undefined): Promise<ErpCatalogPage> {
        this.calls.push(cursor);
        const index = cursor === undefined ? 0 : Number(cursor);
        return this.pages[index] ?? { items: [] };
    }
    protected async writeOutboxEvent(eventType: Subjects, payload: any): Promise<void> {
        this.written.push({ eventType, payload });
    }
    setCredentials(c: any) { this.credentials = c; }
}

/** listCatalogPage YAZMAMIŞ ERP (ör. Nilvera). */
class UnsupportedErp extends ErpIntegration {
    protected getDefaultCredentials() { return {}; }
    protected validatePlatformCredentials() {}
    protected async connect() {}
    protected async syncProducts() {}
    protected async createInvoice() { return ''; }
    protected async syncContacts() {}
    protected async updateStock() {}
    protected formalizeInvoice = undefined;
    protected updatePrice = undefined;
    protected checkBalance = undefined;
    protected deleteInvoice = undefined;
}

const baseCredentials = (stockSources: any[] = [{ integrationId: 'erp-1', enabled: true, warehouseId: 'W1', shelfId: 'S1', sourceLocationId: null }]) => ({
    user: 'user-1',
    platform: ResourceName.KolayBi,
    integrationId: 'erp-1',
    stock_update_settings: { enabled: true, sources: stockSources }
});

describe('ErpIntegration.fetchStocks — sayfa sayfa ProductStockIntegrationUpdated (ikas deseni)', () => {
    it('her sayfa ayrı Outbox olayı; kaynak platform, barkod yedeği, eksi stok satırı OLDUĞU GİBİ iletilir (UC-2628)', async () => {
        const erp = new FakeErp();
        erp.setCredentials(baseCredentials());
        erp.pages = [
            { items: [item({ sku: 'A', barcode: '', stock: 3 })], next: 1 },
            { items: [item({ sku: 'B', barcode: '777', stock: 4 }), item({ sku: 'NEG', stock: -2 })], next: null }
        ];
        const result: any = await erp.fetchStocks();
        expect(result).toEqual({ success: true, data: { pages: 2, rows: 3, events: 2 } });
        expect(erp.calls).toEqual([undefined, 1]);
        expect(erp.written.map(w => w.eventType)).toEqual([Subjects.ProductStockIntegrationUpdated, Subjects.ProductStockIntegrationUpdated]);
        const [first, second] = erp.written.map(w => w.payload);
        expect(first).not.toHaveProperty('sourceType');
        expect(first).toMatchObject({ userId: 'user-1', source: ResourceName.KolayBi, data: [{ sku: 'A', barcode: 'A', quantity: 3, warehouseId: 'W1', shelfId: 'S1' }] });
        expect(second.data).toEqual([
            { sku: 'B', barcode: '777', quantity: 4, warehouseId: 'W1', shelfId: 'S1' },
            { sku: 'NEG', barcode: '869000', quantity: -2, warehouseId: 'W1', shelfId: 'S1' }
        ]);
        expect(first.requestId).not.toBe(second.requestId);
    });

    it('birden çok hedef: her hedef için ayrı olay, kendi deposundan miktar', async () => {
        const erp = new FakeErp();
        erp.setCredentials(baseCredentials([
            { integrationId: 'erp-1', enabled: true, warehouseId: 'W1', sourceLocationId: 'D1' },
            { integrationId: 'erp-1', enabled: true, warehouseId: 'W2', sourceLocationId: 'D2' }
        ]));
        erp.pages = [{ items: [item({ stockByLocation: [{ locationId: 'D1', quantity: 1 }, { locationId: 'D2', quantity: 8 }] })] }];
        await erp.fetchStocks();
        expect(erp.written).toHaveLength(2);
        expect(erp.written.map(w => w.payload.data.map((r: any) => [r.warehouseId, r.quantity]))).toEqual([[['W1', 1]], [['W2', 8]]]);
        expect(erp.written[0].payload.requestId).not.toBe(erp.written[1].payload.requestId);
    });

    it('pasif ve deposuz kaynak atlanır; etkin yoksa sources[0] yedeği (pazaryeri kalıbı)', async () => {
        const erp = new FakeErp();
        erp.setCredentials(baseCredentials([
            { integrationId: 'erp-1', enabled: false, warehouseId: 'W0' },
            { integrationId: 'erp-1', enabled: true, warehouseId: '' },
            { integrationId: 'erp-1', enabled: true, warehouseId: 'W3' }
        ]));
        erp.pages = [{ items: [item()] }];
        await erp.fetchStocks();
        expect(erp.written).toHaveLength(1);
        expect(erp.written[0].payload.data[0].warehouseId).toBe('W3');

        const fallback = new FakeErp();
        fallback.setCredentials(baseCredentials([{ integrationId: 'erp-1', enabled: false, warehouseId: 'W0' }]));
        fallback.pages = [{ items: [item()] }];
        await fallback.fetchStocks();
        expect(fallback.written[0].payload.data[0].warehouseId).toBe('W0');
    });

    it('stok ayarı kapalıysa hata (Trendyol/ikas kapısı), ERP okunmaz', async () => {
        const erp = new FakeErp();
        erp.setCredentials({ ...baseCredentials(), stock_update_settings: { enabled: false, sources: [] } });
        await expect(erp.fetchStocks()).rejects.toThrow('Product stocks fetching is not active');
        expect(erp.calls).toHaveLength(0);
    });

    it('tek ürün çekmede yalnız eşleşen SKU yazılır', async () => {
        const erp = new FakeErp();
        erp.setCredentials(baseCredentials());
        erp.pages = [{ items: [item({ sku: 'A' }), item({ sku: 'B', barcode: 'BB' })] }];
        await erp.fetchStocks({ sku: 'B' });
        expect(erp.written[0].payload.data.map((r: any) => r.sku)).toEqual(['B']);
    });

    it('boş sayfa olay üretmez', async () => {
        const erp = new FakeErp();
        erp.setCredentials(baseCredentials());
        erp.pages = [{ items: [], next: 1 }, { items: [item()] }];
        const result: any = await erp.fetchStocks();
        expect(result.data).toEqual({ pages: 2, rows: 1, events: 1 });
    });

    it('ERP aynı imleci tekrar dönerse döngü kesilir; sayfa sınırı aşılmaz', async () => {
        const erp = new FakeErp();
        erp.setCredentials(baseCredentials());
        erp.pages = [{ items: [item()], next: 1 }, { items: [item()], next: 1 }];
        const result: any = await erp.fetchStocks();
        expect(result.data.pages).toBe(2);

        const runaway = new FakeErp();
        runaway.setCredentials(baseCredentials());
        (runaway as any).maxCatalogPages = 3;
        (runaway as any).listCatalogPage = async (cursor: any) => ({ items: [item()], next: (Number(cursor) || 0) + 1 });
        const r2: any = await runaway.fetchStocks();
        expect(r2.data.pages).toBe(3);
    });
});

describe('ErpIntegration.fetchStocks — kalıp sapması yok', () => {
    it('çok hedefte sayfa başına HEDEF SAYISI kadar olay (kaynak başına); ürün seçili depoda yoksa o hedefe 0 yazılır (satır atlanmaz)', async () => {
        const erp = new FakeErp();
        erp.setCredentials(baseCredentials([
            { integrationId: 'erp-1', enabled: true, warehouseId: 'A', sourceLocationId: 'D1' },
            { integrationId: 'erp-1', enabled: true, warehouseId: 'B', sourceLocationId: 'D2' }
        ]));
        erp.pages = [{ items: [item({ stockByLocation: [{ locationId: 'D2', quantity: 20 }] })] }];
        const result: any = await erp.fetchStocks();
        expect(erp.written).toHaveLength(2);
        expect(erp.written.map(w => w.payload.data.map((r: any) => [r.warehouseId, r.quantity]))).toEqual([[['A', 0]], [['B', 20]]]);
        expect(result.data).toEqual({ pages: 1, rows: 2, events: 2 });
    });

    it('olay yükünde pazaryeri olayında olmayan alan YOK (sourceType, bayrak, processId)', async () => {
        const erp = new FakeErp();
        erp.setCredentials(baseCredentials());
        erp.pages = [{ items: [item()] }];
        await erp.fetchStocks();
        expect(Object.keys(erp.written[0].payload).sort()).toEqual(['data', 'requestId', 'source', 'timestamp', 'userId']);
    });

    it('ERP stok olayı yalnız ProductStockIntegrationUpdated konusuna yazılır (rezerv alanına dokunan yük taşımaz)', async () => {
        const erp = new FakeErp();
        erp.setCredentials(baseCredentials());
        erp.pages = [{ items: [item({ stock: 10 })] }];
        await erp.fetchStocks();
        expect(erp.written.every(w => w.eventType === Subjects.ProductStockIntegrationUpdated)).toBe(true);
        expect(Object.keys(erp.written[0].payload.data[0]).sort()).toEqual(['barcode', 'quantity', 'shelfId', 'sku', 'warehouseId']);
    });

    it('A→B→A imleç döngüsü görülen imleç kümesiyle kesilir (5000 sayfaya gitmez)', async () => {
        const erp = new FakeErp();
        erp.setCredentials(baseCredentials());
        const seq: Record<string, string> = { start: 'A', A: 'B', B: 'A' };
        (erp as any).listCatalogPage = async (cursor: any) => ({ items: [item()], next: seq[cursor ?? 'start'] });
        const result: any = await erp.fetchStocks();
        expect(result.data.pages).toBe(3);
    });
});

describe('ErpIntegration.fetchPrices — pazaryeriyle aynı: istek/yanıt ProductPriceIntegrationUpdated[]', () => {
    const priceCredentials = () => ({ ...baseCredentials(), price_update_settings: { enabled: true, sources: [] } });

    it('tüm sayfaların fiyatları TEK dizide döner, KDV dahil; olay YAZILMAZ', async () => {
        const erp = new FakeErp();
        erp.setCredentials(priceCredentials());
        erp.pages = [
            { items: [item({ sku: 'A', salePrice: 100, salePriceVatIncluded: false, vatRate: 20 })], next: 1 },
            { items: [item({ sku: 'B', salePrice: 30, salePriceVatIncluded: true })], next: undefined }
        ];
        const result: any = await erp.fetchPrices();
        expect(result).toEqual([
            { sku: 'A', barcode: '869000', price: 120, source: ResourceName.KolayBi, integrationName: ResourceName.KolayBi },
            { sku: 'B', barcode: '869000', price: 30, source: ResourceName.KolayBi, integrationName: ResourceName.KolayBi }
        ]);
        expect(erp.written).toHaveLength(0);
    });

    it('fiyat yoksa null döner (Trendyol/ikas kalıbı)', async () => {
        const erp = new FakeErp();
        erp.setCredentials(priceCredentials());
        erp.pages = [{ items: [item({ salePrice: null })] }];
        await expect(erp.fetchPrices()).resolves.toBeNull();
    });

    it('fiyat ayarı kapalıysa hata (pazaryeri kapısı)', async () => {
        const erp = new FakeErp();
        erp.setCredentials({ ...baseCredentials(), price_update_settings: { enabled: false } });
        await expect(erp.fetchPrices()).rejects.toThrow('Product price fetching is not active');
        expect(erp.calls).toHaveLength(0);
    });

    it('tek ürün çekmede yalnız eşleşen SKU döner', async () => {
        const erp = new FakeErp();
        erp.setCredentials(priceCredentials());
        erp.pages = [{ items: [item({ sku: 'A' }), item({ sku: 'B', barcode: 'BB' })] }];
        const result: any = await erp.fetchPrices({ sku: 'B' });
        expect(result.map((r: any) => r.sku)).toEqual(['B']);
    });
});

describe('ErpIntegration — desteklemeyen ERP', () => {
    it('listCatalogPage/listLocations yoksa UNSUPPORTED_COMMAND_RESPONSE döner', async () => {
        const erp = new UnsupportedErp();
        expect(erp.supportsCatalogFetch()).toBe(false);
        await expect(erp.fetchStocks()).resolves.toBe(UNSUPPORTED_COMMAND_RESPONSE);
        await expect(erp.fetchPrices()).resolves.toBe(UNSUPPORTED_COMMAND_RESPONSE);
        await expect(erp.fetchLocations()).resolves.toBe(UNSUPPORTED_COMMAND_RESPONSE);
    });

    it('listLocations varsa depo listesi döner', async () => {
        const erp = new FakeErp();
        (erp as any).listLocations = async () => [{ id: 'D1', name: 'Ana' }];
        await expect(erp.fetchLocations()).resolves.toEqual({ success: true, data: [{ id: 'D1', name: 'Ana' }] });
    });
});

describe('CredentialsService — ERP stok/fiyat kaynak ayarı da bu entegrasyona süzülür', () => {
    const settings = {
        stock_update_settings: JSON.stringify({ enabled: true, sources: [
            { integrationId: 'erp-1', name: 'KolayBi', enabled: true, warehouseId: 'W1' },
            { integrationId: 'shop-1', name: 'Shopify', enabled: true, warehouseId: 'W2' }
        ] }),
        price_update_settings: JSON.stringify({ enabled: true, sources: [
            { integrationId: 'erp-1', name: 'KolayBi', enabled: false },
            { integrationId: 'shop-1', name: 'Shopify', enabled: true }
        ] })
    };
    it('ERP tipi için sources yalnız kendi kaynağı, enabled kaynağın değeri', () => {
        const parsed: any = CredentialsService.mergeAndParse(settings, {}, 'erp-1', 'KolayBi', IntegrationType.Erp);
        expect(parsed.stock_update_settings.sources.map((s: any) => s.integrationId)).toEqual(['erp-1']);
        expect(parsed.stock_update_settings.enabled).toBe(true);
        expect(parsed.price_update_settings.sources.map((s: any) => s.integrationId)).toEqual(['erp-1']);
        expect(parsed.price_update_settings.enabled).toBe(false);
    });
    it('ERP için gönderim kapıları doldurulmaz (yalnız çekme ayarları açıldı)', () => {
        const parsed: any = CredentialsService.mergeAndParse(settings, {}, 'erp-1', 'KolayBi', IntegrationType.Erp);
        expect(parsed.stockPushEnabled).toBeUndefined();
        expect(parsed.pricePushEnabled).toBeUndefined();
    });
});
