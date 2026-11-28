import type mongoose from "mongoose";
import { BaseIntegration } from "./base-integration";
import { ResourceName } from "../types/resourceName";
import { Subjects } from "../events/subjects";
import { UNSUPPORTED_COMMAND_RESPONSE } from "../constants/integration-commands";
import { ProductPriceIntegrationUpdated } from "../interfaces/product-price-integration-updated.interface";
import { ErpCatalogCursor, ErpCatalogPage, ErpCatalogQuery, ErpLocation } from "../interfaces/erp-catalog.interface";
import { ErpStockTarget } from "./erp-catalog.util";
/** `fetchStocks`/`fetchPrices` komut parametreleri (integration `StockFetcherService`/`PriceFetcherService`). */
export interface ErpFetchParams {
    sku?: string;
    barcode?: string;
}
/** ERP katalog çekme komutlarının sonucu (komut sonucu olayına yazılır). */
export interface ErpFetchResult {
    success: boolean;
    message?: string;
    data?: {
        pages: number;
        rows: number;
        events: number;
    };
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
export declare abstract class ErpIntegration extends BaseIntegration {
    constructor();
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
    protected abstract formalizeInvoice?(params: {
        erpId: string;
        category?: string;
        invoiceData?: any;
    }): Promise<any>;
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
    protected abstract deleteInvoice?(erpId: string): Promise<{
        success: boolean;
        message?: string;
    }>;
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
    protected maxCatalogPages: number;
    /** ERP stok/fiyat çekmeyi destekliyor mu (eşleyici yazılmış mı). */
    supportsCatalogFetch(): boolean;
    /**
     * Stokları sayfa sayfa çeker ve her etkin kaynak (depo/raf) için AYRI `ProductStockIntegrationUpdated`
     * olayı yayınlar (ikas/Shopify/Trendyol deseni: kaynak başına olay, `requestId` olay başına benzersiz).
     * Ayar kapısı pazaryeriyle aynı: `stock_update_settings.enabled` kapalıysa hata, etkin kaynak yoksa `sources[0]` yedeği.
     */
    fetchStocks(params?: ErpFetchParams): Promise<ErpFetchResult | typeof UNSUPPORTED_COMMAND_RESPONSE>;
    /**
     * Fiyatları pazaryeriyle AYNI biçimde döner: istek/yanıt, `ProductPriceIntegrationUpdated[]` (kayıt yoksa null).
     * Kural, kur ve strateji `priceUpdateService` / pricing'de uygulanır; ERP için ayrı olay/kilit yoktur.
     */
    fetchPrices(params?: ErpFetchParams): Promise<ProductPriceIntegrationUpdated[] | null | typeof UNSUPPORTED_COMMAND_RESPONSE>;
    /** ERP depo listesi (stok kaynağı ayarında `sourceLocationId` seçimi için). */
    fetchLocations(): Promise<{
        success: boolean;
        data: ErpLocation[];
    } | typeof UNSUPPORTED_COMMAND_RESPONSE>;
    /**
     * Kataloğu baştan sona dolaşır; her sayfa için `onPage` çağrılır. Dönüş: okunan sayfa sayısı.
     * `next` daha önce görülmüş bir imleci tekrar ederse (art arda ya da A→B→A) ya da `maxCatalogPages` aşılırsa durur (sonsuz döngü koruması).
     */
    protected walkCatalog(query: ErpCatalogQuery | undefined, onPage: (items: ErpCatalogPage['items'], pageIndex: number, isLastPage: boolean, startedAt: Date) => Promise<void>): Promise<number>;
    /**
     * Stok kaynağı ayarından etkin hedefler. Ayar `CredentialsService` tarafından bu entegrasyonun
     * kaynağına süzülmüş gelir; etkin kaynak yoksa pazaryeri gibi `sources[0]` yedeği kullanılır.
     */
    protected resolveStockTargets(): ErpStockTarget[];
    protected resolvePlatform(): ResourceName;
    private toQuery;
    /**
     * UC-2619F (Y1) — servis startup'ında çağrılır: Outbox'a SERVİSİN kendi mongoose bağlantısıyla yazılır.
     * moon-lib'in kendi `mongoose` örneği (dev imajında ayrı node_modules) bağlanmamış olabilir; bu yüzden
     * `AuthFailureTracker.initialize` / `EventPublisherJob(…, connection)` kalıbıyla bağlantı dışarıdan verilir.
     */
    static initializeOutbox(connection: mongoose.Connection): void;
    private static outboxConnection?;
    /** Olayı servisin Outbox'ına, enjekte edilen bağlantıyla yazar (testte taklit edilebilir). Bağlantı yoksa AÇIK hata verir. */
    protected writeOutboxEvent(eventType: Subjects, payload: any): Promise<void>;
}
//# sourceMappingURL=erp-integration.d.ts.map