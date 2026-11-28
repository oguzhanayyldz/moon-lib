import { BaseIntegration } from "./base-integration";
import { ResourceName } from "../types/resourceName";
import { Subjects } from "../events/subjects";
import { UNSUPPORTED_COMMAND_RESPONSE } from "../constants/integration-commands";
import { ErpCatalogCursor, ErpCatalogPage, ErpCatalogQuery, ErpLocation } from "../interfaces/erp-catalog.interface";
import { ErpStockTarget } from "./erp-catalog.util";
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
    data?: {
        pages: number;
        rows: number;
        events: number;
        processId?: string;
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
     * Stokları sayfa sayfa çeker; her sayfayı her stok hedefi için `ProductStockIntegrationUpdated` olarak
     * Outbox'a yazar (ikas deseni). inventory eşler, kuralları uygular, pazaryerlerine yayar.
     */
    fetchStocks(params?: ErpFetchParams): Promise<ErpFetchResult | typeof UNSUPPORTED_COMMAND_RESPONSE>;
    /**
     * Fiyatları sayfa sayfa çeker ve `ProductPriceIntegrationFetched` olarak yayınlar (B4: istek/yanıt YOK,
     * 30 sn sınırı yok). Fiyat KDV dahildir (B6); kurallar ve kur dönüşümü integration dinleyicisinde.
     */
    fetchPrices(params?: ErpFetchParams): Promise<ErpFetchResult | typeof UNSUPPORTED_COMMAND_RESPONSE>;
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
     * Kullanıcının stok kaynağı ayarından BU entegrasyonun etkin hedefleri.
     * Ayar düz metin (JSON) gelebilir; başka entegrasyonun kaynağı (integrationId farklı) alınmaz.
     */
    protected resolveStockTargets(): ErpStockTarget[];
    protected resolvePlatform(): ResourceName;
    private toQuery;
    /** Olayı servisin Outbox'ına yazar (testte taklit edilebilir). */
    protected writeOutboxEvent(eventType: Subjects, payload: any): Promise<void>;
}
