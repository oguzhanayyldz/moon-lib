import { ResourceName } from "../types/resourceName";
import { Subjects } from "./subjects";
/**
 * Tek bir ürün/varyant için stok güncelleme teyit sonucu.
 * `externalId` platform tarafındaki tekil tanımlayıcıdır
 * (Trendyol=barcode, Hepsiburada=hbSku, N11=stockCode, Amazon=sku, ...).
 */
export interface StockUpdateConfirmedItem {
    externalId: string;
    success: boolean;
    /** Başarısızsa platform tarafından dönen hata sebebi. */
    reason?: string;
}
/**
 * StockUpdateConfirmed (issue #567)
 *
 * Entegrasyon servisi, stok güncellemesinin platforma GERÇEKTEN yazıldığını
 * (async batch status sonucu veya sync API yanıtı) catalog'a geri besler.
 *
 * Mevcut `IntegrationCommandResult` async platformlarda sadece "batch gönderildi"
 * teyidi verir; bu event ise "stok platforma yazıldı" teyidi verir.
 *
 * Correlation: `requestId` catalog'un ürettiği IntegrationCommand requestId'sidir.
 * Per-item eşleştirme `externalId` ile yapılır.
 */
export interface StockUpdateConfirmedEvent {
    subject: Subjects.StockUpdateConfirmed;
    data: {
        requestId: string;
        user: string;
        platform: ResourceName;
        command: string;
        /** Force-zero-stock (pasifleştirme) akışında true. Reconciliation bunu kullanır. */
        zeroStock?: boolean;
        items: StockUpdateConfirmedItem[];
        timestamp: string;
    };
}
//# sourceMappingURL=stock-update-confirmed-event.d.ts.map