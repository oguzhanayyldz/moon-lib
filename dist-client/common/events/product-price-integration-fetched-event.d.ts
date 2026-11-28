import { Subjects } from "./subjects";
import { ResourceName } from "../types/resourceName";
import { CurrencyCode } from "../types/currency-code";
import { ProductPriceIntegrationUpdated } from "../interfaces/product-price-integration-updated.interface";
/** ERP'den çekilmiş HAM fiyat kalemi: fiyat KDV dahildir, kur dönüşümü ve kurallar HENÜZ uygulanmamıştır. */
export interface ProductPriceIntegrationFetchedItem extends ProductPriceIntegrationUpdated {
    /** Kalemin ERP'deki para birimi; integration kur dönüşümünü bundan yapar. */
    currency?: CurrencyCode | string | null;
}
/**
 * UC-2595 (B4) — ERP fiyat çekme ASENKRON akışı.
 *
 * Pazaryeri fiyatı istek/yanıtla (30 sn) çekilir; büyük ERP kataloğu bu süreye sığmaz.
 * ERP servisi (`ErpIntegration.fetchPrices`) her sayfayı bu olayla Outbox'a yazar.
 * integration servisi (`ProductPriceIntegrationFetchedListener`) kaynağın kurallarını ve kur
 * dönüşümünü uygular, sonucu `ProductPriceIntegrationUpdated` olarak pricing'e iletir.
 * Pazaryerleri eski yoldan devam eder.
 */
export interface ProductPriceIntegrationFetchedEvent {
    subject: Subjects.ProductPriceIntegrationFetched;
    data: {
        /** Sayfa başına BENZERSİZ kimlik (`<processId>:<platform>:p<sayfa>`) — idempotans anahtarı. */
        requestId: string;
        /** Tetiklemenin süreç kimliği (integration `runPriceUpdate` processId). */
        processId: string;
        userId: string;
        /** Fiyat kaynağı entegrasyonun kimliği (kullanıcı ayarındaki `sources[].integrationId`). */
        integrationId?: string;
        source: ResourceName;
        /** 1'den başlar. */
        pageIndex: number;
        /** Son sayfada true. */
        isLastPage: boolean;
        data: ProductPriceIntegrationFetchedItem[];
        /** Sayfanın ERP'den okunmaya başlandığı an (pricing bayat-veri kapısı için). */
        timestamp: Date;
    };
}
