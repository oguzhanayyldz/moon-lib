import type mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { IntegrationType } from "../types/integration-type";
import { BaseIntegration } from "./base-integration";
import { ResourceName } from "../types/resourceName";
import { Subjects } from "../events/subjects";
import { UNSUPPORTED_COMMAND_RESPONSE } from "../constants/integration-commands";
import { ProductPriceIntegrationUpdated } from "../interfaces/product-price-integration-updated.interface";
import { ErpCatalogCursor, ErpCatalogPage, ErpCatalogQuery, ErpLocation } from "../interfaces/erp-catalog.interface";
import { buildErpPriceRows, buildErpStockRows, ErpStockTarget, matchesErpQuery } from "./erp-catalog.util";
import { createOutboxModel } from "../../models/outbox.schema";
import { OptimisticLockingUtil } from "../../utils/optimisticLocking.util";
import { logger } from "../../services/logger.service";

/** `fetchStocks`/`fetchPrices` komut parametreleri (integration `StockFetcherService`/`PriceFetcherService`). */
export interface ErpFetchParams {
    sku?: string;
    barcode?: string;
}

/** ERP katalog çekme komutlarının sonucu (komut sonucu olayına yazılır). */
export interface ErpFetchResult {
    success: boolean;
    message?: string;
    data?: { pages: number; rows: number; events: number };
}


/**
 * ERP Integration Base Class
 *
 * ERP (Enterprise Resource Planning) entegrasyonları için temel sınıf.
 * Marketplace ve E-commerce entegrasyonlarından farklı olarak:
 * - Siparişleri çekmek yerine ERP'ye gönderir (fatura kesme)
 * - Ürün/stok kartı senkronizasyonu
 * - Cari (müşteri/tedarikçi) yönetimi
 * - Fatura resmileştirme işlemleri (e-Arşiv, e-Fatura)
 *
 * @abstract
 * @extends BaseIntegration
 */
export abstract class ErpIntegration extends BaseIntegration {
    constructor () {
        super();
        this.type = IntegrationType.Erp;
    }

    // === ERP-specific abstract metodlar ===

    /**
     * Ürünleri/Stok kartlarını ERP sisteminden çeker veya ERP'ye gönderir
     */
    protected abstract syncProducts(): Promise<void>;

    /**
     * Sipariş verilerinden fatura oluşturur
     */
    protected abstract createInvoice(orderData: any): Promise<string>;

    /**
     * Oluşturulan faturayı resmileştirir (e-Arşiv veya e-Fatura)
     */
    protected abstract formalizeInvoice?(params: { erpId: string; category?: string; invoiceData?: any }): Promise<any>;

    /**
     * Cari hesapları (müşteri/tedarikçi) senkronize eder
     */
    protected abstract syncContacts(): Promise<void>;

    /**
     * Stok miktarını günceller
     */
    protected abstract updateStock(sku: string, quantity: number): Promise<void>;

    /**
     * Fiyat günceller
     */
    protected abstract updatePrice?(sku: string, price: number): Promise<void>;

    /**
     * Fatura kesme bakiyesi/kotasını kontrol eder
     */
    protected abstract checkBalance?(): Promise<number>;

    /**
     * ERP sistemindeki faturayı siler
     */
    protected abstract deleteInvoice?(erpId: string): Promise<{ success: boolean; message?: string }>;

    // === UC-2595: ERP'den stok/fiyat ÇEKME ortak temeli ===

    /**
     * ERP kataloğunun BİR sayfası. Her ERP eşleyicisi yalnız bunu yazar; sayfalama, KDV dönüşümü,
     * barkod yedeği ve olay yayını aşağıdaki somut `fetchStocks`/`fetchPrices` içinde ORTAKTIR.
     * Yazılmadıysa ERP stok/fiyat çekmeyi desteklemiyor sayılır (`UNSUPPORTED_COMMAND_RESPONSE`).
     *
     * @param cursor ilk çağrıda undefined; sonrakilerde bir önceki sayfanın `next` değeri
     * @param query elle tek ürün çekmede sku/barkod (eşleyici sunucu tarafında süzebilir; süzmese de ortak katman süzer)
     */
    protected listCatalogPage?(cursor: ErpCatalogCursor | undefined, query?: ErpCatalogQuery): Promise<ErpCatalogPage>;

    /** ERP depo listesi; yazılmadıysa `fetchLocations` desteklenmez. */
    protected listLocations?(): Promise<ErpLocation[]>;

    /** Sonsuz sayfalama koruması (ERP hep `next` dönerse). */
    protected maxCatalogPages = 5000;

    /** ERP stok/fiyat çekmeyi destekliyor mu (eşleyici yazılmış mı). */
    supportsCatalogFetch(): boolean {
        return typeof this.listCatalogPage === 'function';
    }

    /**
     * Stokları sayfa sayfa çeker ve her etkin kaynak (depo/raf) için AYRI `ProductStockIntegrationUpdated`
     * olayı yayınlar (ikas/Shopify/Trendyol deseni: kaynak başına olay, `requestId` olay başına benzersiz).
     * Ayar kapısı pazaryeriyle aynı: `stock_update_settings.enabled` kapalıysa hata, etkin kaynak yoksa `sources[0]` yedeği.
     */
    async fetchStocks(params?: ErpFetchParams): Promise<ErpFetchResult | typeof UNSUPPORTED_COMMAND_RESPONSE> {
        if (!this.supportsCatalogFetch()) {
            logger.info(`${this.constructor.name}: fetchStocks not supported (listCatalogPage yok)`);
            return UNSUPPORTED_COMMAND_RESPONSE;
        }
        if (!this.credentials?.stock_update_settings?.enabled) {
            throw new Error('Product stocks fetching is not active. Please enable it in the credentials.');
        }

        const targets = this.resolveStockTargets();
        if (targets.length === 0) {
            throw new Error('No sources configured for stock fetching');
        }

        const platform = this.resolvePlatform();
        const query = this.toQuery(params);
        let rows = 0;
        let events = 0;

        const pages = await this.walkCatalog(query, async (items) => {
            for (const target of targets) {
                const stockRows = buildErpStockRows(items, target);
                if (stockRows.length === 0) continue;
                await this.writeOutboxEvent(Subjects.ProductStockIntegrationUpdated, {
                    requestId: uuidv4(),
                    userId: this.credentials.user,
                    data: stockRows,
                    source: platform,
                    timestamp: new Date()
                });
                rows += stockRows.length;
                events++;
            }
        });

        logger.info(`${this.constructor.name}: ERP stok çekme bitti`, { pages, rows, events, user: this.credentials?.user });
        return { success: true, data: { pages, rows, events } };
    }

    /**
     * Fiyatları pazaryeriyle AYNI biçimde döner: istek/yanıt, `ProductPriceIntegrationUpdated[]` (kayıt yoksa null).
     * Kural, kur ve strateji `priceUpdateService` / pricing'de uygulanır; ERP için ayrı olay/kilit yoktur.
     */
    async fetchPrices(params?: ErpFetchParams): Promise<ProductPriceIntegrationUpdated[] | null | typeof UNSUPPORTED_COMMAND_RESPONSE> {
        if (!this.supportsCatalogFetch()) {
            logger.info(`${this.constructor.name}: fetchPrices not supported (listCatalogPage yok)`);
            return UNSUPPORTED_COMMAND_RESPONSE;
        }
        if (!this.credentials?.price_update_settings?.enabled) {
            throw new Error('Product price fetching is not active. Please enable it in the credentials.');
        }

        const platform = this.resolvePlatform();
        const query = this.toQuery(params);
        const prices: ProductPriceIntegrationUpdated[] = [];

        await this.walkCatalog(query, async (items) => {
            prices.push(...buildErpPriceRows(items, platform));
        });

        logger.info(`${this.constructor.name}: ERP fiyat çekme bitti`, { rows: prices.length, user: this.credentials?.user });
        return prices.length > 0 ? prices : null;
    }

    /** ERP depo listesi (stok kaynağı ayarında `sourceLocationId` seçimi için). */
    async fetchLocations(): Promise<{ success: boolean; data: ErpLocation[] } | typeof UNSUPPORTED_COMMAND_RESPONSE> {
        if (typeof this.listLocations !== 'function') {
            return UNSUPPORTED_COMMAND_RESPONSE;
        }
        const locations = await this.listLocations();
        return { success: true, data: locations || [] };
    }

    /**
     * Kataloğu baştan sona dolaşır; her sayfa için `onPage` çağrılır. Dönüş: okunan sayfa sayısı.
     * `next` daha önce görülmüş bir imleci tekrar ederse (art arda ya da A→B→A) ya da `maxCatalogPages` aşılırsa durur (sonsuz döngü koruması).
     */
    protected async walkCatalog(
        query: ErpCatalogQuery | undefined,
        onPage: (items: ErpCatalogPage['items'], pageIndex: number, isLastPage: boolean, startedAt: Date) => Promise<void>
    ): Promise<number> {
        let cursor: ErpCatalogCursor | undefined = undefined;
        let pageIndex = 0;
        // DÜŞÜK-2: yalnız art arda değil A→B→A döngüsünü de yakalamak için görülen tüm imleçler tutulur.
        const seenCursors = new Set<string>();
        while (pageIndex < this.maxCatalogPages) {
            pageIndex++;
            const startedAt = new Date();
            const page: ErpCatalogPage = await this.listCatalogPage!(cursor, query);
            const items = (page?.items || []).filter(item => matchesErpQuery(item, query));
            const next = page?.next;
            const nextKey = next === undefined || next === null || next === '' ? null : JSON.stringify(next);
            if (cursor !== undefined && cursor !== null) seenCursors.add(JSON.stringify(cursor));
            const isLastPage = nextKey === null || next === cursor || seenCursors.has(nextKey);
            await onPage(items, pageIndex, isLastPage, startedAt);
            if (isLastPage) return pageIndex;
            cursor = next as ErpCatalogCursor;
        }
        logger.warn(`${this.constructor.name}: katalog sayfa sınırına (${this.maxCatalogPages}) ulaşıldı, çekme kesildi`);
        return pageIndex;
    }

    /**
     * Stok kaynağı ayarından etkin hedefler. Ayar `CredentialsService` tarafından bu entegrasyonun
     * kaynağına süzülmüş gelir; etkin kaynak yoksa pazaryeri gibi `sources[0]` yedeği kullanılır.
     */
    protected resolveStockTargets(): ErpStockTarget[] {
        const sources: any[] = Array.isArray(this.credentials?.stock_update_settings?.sources)
            ? this.credentials.stock_update_settings.sources
            : [];
        let chosen = sources.filter(s => s && s.enabled);
        if (chosen.length === 0 && sources[0]) chosen = [sources[0]];
        return chosen
            .filter(s => s.warehouseId)
            .map(s => ({ warehouseId: String(s.warehouseId), shelfId: s.shelfId || null, sourceLocationId: s.sourceLocationId || null }));
    }

    protected resolvePlatform(): ResourceName {
        return (this.credentials?.platform || this.platform) as ResourceName;
    }

    private toQuery(params?: ErpFetchParams): ErpCatalogQuery | undefined {
        if (!params || (!params.sku && !params.barcode)) return undefined;
        return { ...(params.sku ? { sku: params.sku } : {}), ...(params.barcode ? { barcode: params.barcode } : {}) };
    }

    /**
     * UC-2619F (Y1) — servis startup'ında çağrılır: Outbox'a SERVİSİN kendi mongoose bağlantısıyla yazılır.
     * moon-lib'in kendi `mongoose` örneği (dev imajında ayrı node_modules) bağlanmamış olabilir; bu yüzden
     * `AuthFailureTracker.initialize` / `EventPublisherJob(…, connection)` kalıbıyla bağlantı dışarıdan verilir.
     */
    static initializeOutbox(connection: mongoose.Connection): void {
        ErpIntegration.outboxConnection = connection;
    }

    private static outboxConnection?: mongoose.Connection;

    /** Olayı servisin Outbox'ına, enjekte edilen bağlantıyla yazar (testte taklit edilebilir). Bağlantı yoksa AÇIK hata verir. */
    protected async writeOutboxEvent(eventType: Subjects, payload: any): Promise<void> {
        const connection = ErpIntegration.outboxConnection;
        if (!connection) {
            throw new Error('ErpIntegration.initializeOutbox(mongoose.connection) çağrılmadı: ERP stok olayı Outbox\'a yazılamaz');
        }
        const Outbox = createOutboxModel(connection);
        const outbox = Outbox.build({ eventType, payload, status: 'pending' } as any);
        await OptimisticLockingUtil.saveWithRetry(outbox);
    }
}
