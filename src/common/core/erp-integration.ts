import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { IntegrationType } from "../types/integration-type";
import { BaseIntegration } from "./base-integration";
import { ResourceName } from "../types/resourceName";
import { Subjects } from "../events/subjects";
import { UNSUPPORTED_COMMAND_RESPONSE } from "../constants/integration-commands";
import { ErpCatalogCursor, ErpCatalogPage, ErpCatalogQuery, ErpLocation } from "../interfaces/erp-catalog.interface";
import { buildErpPriceRows, buildErpStockRows, ErpStockTarget, matchesErpQuery } from "./erp-catalog.util";
import { createOutboxModel } from "../../models/outbox.schema";
import { OptimisticLockingUtil } from "../../utils/optimisticLocking.util";
import { logger } from "../../services/logger.service";

/** `fetchStocks`/`fetchPrices` komut parametreleri (integration `StockFetcherService`/`PriceFetcherService`). */
export interface ErpFetchParams {
    sku?: string;
    barcode?: string;
    /** Fiyat tetiklemesinin süreç kimliği; yoksa üretilir. */
    processId?: string;
}

/** ERP katalog çekme komutlarının sonucu (komut sonucu olayına yazılır). */
export interface ErpFetchResult {
    success: boolean;
    message?: string;
    data?: { pages: number; rows: number; events: number; processId?: string };
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
     * Stokları sayfa sayfa çeker; her sayfayı her stok hedefi için `ProductStockIntegrationUpdated` olarak
     * Outbox'a yazar (ikas deseni). inventory eşler, kuralları uygular, pazaryerlerine yayar.
     */
    async fetchStocks(params?: ErpFetchParams): Promise<ErpFetchResult | typeof UNSUPPORTED_COMMAND_RESPONSE> {
        if (!this.supportsCatalogFetch()) {
            logger.info(`${this.constructor.name}: fetchStocks not supported (listCatalogPage yok)`);
            return UNSUPPORTED_COMMAND_RESPONSE;
        }

        const targets = this.resolveStockTargets();
        if (targets.length === 0) {
            logger.warn(`${this.constructor.name}: stok kaynağı/hedef depo yok, stok çekilmedi`, { user: this.credentials?.user });
            return { success: false, message: 'errors.integration.erp.noStockSource' };
        }

        const platform = this.resolvePlatform();
        const query = this.toQuery(params);
        let rows = 0;
        let events = 0;

        const pages = await this.walkCatalog(query, async (items) => {
            // ORTA-3b: sayfa başına TEK olay; bütün hedeflerin satırları hedef sırasıyla (birincil önce) gider.
            // inventory açık sipariş adedini olay başına bir kez hesaplar ve ürünün satırlarına bu sırayla dağıtır
            // (birincilde karşılanmayan kalan sıradaki hedeften düşer) → toplamda tam bir kez, hiçbir depo 0'ın altına inmez.
            const stockRows = targets.flatMap(target => buildErpStockRows(items, target));
            if (stockRows.length === 0) return;
            await this.writeOutboxEvent(Subjects.ProductStockIntegrationUpdated, {
                requestId: uuidv4(),
                userId: this.credentials.user,
                data: stockRows,
                source: platform,
                sourceType: IntegrationType.Erp,
                timestamp: new Date()
            });
            rows += stockRows.length;
            events++;
        });

        logger.info(`${this.constructor.name}: ERP stok çekme bitti`, { pages, rows, events, user: this.credentials?.user });
        return { success: true, data: { pages, rows, events } };
    }

    /**
     * Fiyatları sayfa sayfa çeker ve `ProductPriceIntegrationFetched` olarak yayınlar (B4: istek/yanıt YOK,
     * 30 sn sınırı yok). Fiyat KDV dahildir (B6); kurallar ve kur dönüşümü integration dinleyicisinde.
     */
    async fetchPrices(params?: ErpFetchParams): Promise<ErpFetchResult | typeof UNSUPPORTED_COMMAND_RESPONSE> {
        if (!this.supportsCatalogFetch()) {
            logger.info(`${this.constructor.name}: fetchPrices not supported (listCatalogPage yok)`);
            return UNSUPPORTED_COMMAND_RESPONSE;
        }

        const platform = this.resolvePlatform();
        const processId = params?.processId || uuidv4();
        const query = this.toQuery(params);
        let rows = 0;
        let events = 0;

        const pages = await this.walkCatalog(query, async (items, pageIndex, isLastPage, startedAt) => {
            const priceRows = buildErpPriceRows(items, platform);
            // DÜŞÜK-1: son sayfa süzgeçten sonra boş kalsa da `isLastPage:true` taşıyan olay gider
            // (tüketicinin kilidi/tamamlanma sinyali buna bağlı); boş kalem listesi tüketicide tolere edilir.
            if (priceRows.length === 0 && !isLastPage) return;
            await this.writeOutboxEvent(Subjects.ProductPriceIntegrationFetched, {
                requestId: `${processId}:${platform}:p${pageIndex}`,
                processId,
                userId: this.credentials.user,
                integrationId: this.credentials?.integrationId ? String(this.credentials.integrationId) : undefined,
                source: platform,
                pageIndex,
                isLastPage,
                data: priceRows,
                timestamp: startedAt
            });
            rows += priceRows.length;
            events++;
        });

        logger.info(`${this.constructor.name}: ERP fiyat çekme bitti`, { pages, rows, events, processId, user: this.credentials?.user });
        return { success: true, data: { pages, rows, events, processId } };
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
     * Kullanıcının stok kaynağı ayarından BU entegrasyonun etkin hedefleri.
     * Ayar düz metin (JSON) gelebilir; başka entegrasyonun kaynağı (integrationId farklı) alınmaz.
     */
    protected resolveStockTargets(): ErpStockTarget[] {
        let settings: any = this.credentials?.stock_update_settings;
        if (typeof settings === 'string') {
            try { settings = JSON.parse(settings); } catch { settings = null; }
        }
        const ownId = this.credentials?.integrationId ? String(this.credentials.integrationId) : null;
        const sources: any[] = Array.isArray(settings?.sources) ? settings.sources : [];
        return sources
            .filter(s => s && s.enabled && s.warehouseId)
            .filter(s => !ownId || !s.integrationId || String(s.integrationId) === ownId)
            .map(s => ({ warehouseId: String(s.warehouseId), shelfId: s.shelfId || null, sourceLocationId: s.sourceLocationId || null }));
    }

    protected resolvePlatform(): ResourceName {
        return (this.credentials?.platform || this.platform) as ResourceName;
    }

    private toQuery(params?: ErpFetchParams): ErpCatalogQuery | undefined {
        if (!params || (!params.sku && !params.barcode)) return undefined;
        return { ...(params.sku ? { sku: params.sku } : {}), ...(params.barcode ? { barcode: params.barcode } : {}) };
    }

    /** Olayı servisin Outbox'ına yazar (testte taklit edilebilir). */
    protected async writeOutboxEvent(eventType: Subjects, payload: any): Promise<void> {
        const Outbox = createOutboxModel(mongoose.connection);
        const outbox = Outbox.build({ eventType, payload, status: 'pending' } as any);
        await OptimisticLockingUtil.saveWithRetry(outbox);
    }
}
