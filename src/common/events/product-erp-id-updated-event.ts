import { Subjects } from "./subjects";
import { ResourceName } from "../types/resourceName";

/**
 * ProductErpIdUpdated Event
 *
 * ERP sistemlerinden (Parasut, Logo, Netsis, etc.) dönen external ID'leri
 * Product ve Combination modeline kaydetmek için kullanılır.
 *
 * ProductUpdated eventinden farkı:
 * - Sadece erpId güncellemesi için (tek sorumluluk)
 * - Minimal payload (sadece id, erpId, version)
 * - Sonsuz döngü riski yok (farklı event tipi)
 *
 * Event flow:
 * 1. Products Service → IntegrationCommand (createProductsBulk)
 * 2. Integration Service → Parasut Service
 * 3. Parasut Service → ProductErpIdUpdated event (başarılı ürünler için)
 * 4. Products Service → ProductErpIdUpdatedListener → Product.erpId güncelle
 */
export interface ProductErpIdUpdatedEvent {
    subject: Subjects.ProductErpIdUpdated;
    data: {
        requestId: string;
        userId: string;
        list: ProductErpIdUpdated[];
    }
}

/**
 * ProductErpIdUpdated List Item
 *
 * Tek bir ürün veya varyantın erpId güncellemesi
 */
export interface ProductErpIdUpdated {
    /** Moon Product ID */
    id: string;

    /** Moon Product ID (duplicate for consistency with other events) */
    product: string;

    /** Moon Combination ID (sadece varyant güncellemeleri için) */
    combination?: string;

    /** ERP sisteminden dönen external ID (Parasut product ID, Logo stok kodu, etc.) */
    erpId: string;

    /**
     * Mevcut version (sonsuz döngü önleme için)
     * Listener sadece eventVersion > currentVersion olan güncellemeleri işler
     */
    version: number;

    /** ERP sistem adı (Parasut, Logo, Netsis, etc.) */
    source: ResourceName;

    /** Event oluşturulma zamanı */
    sourceTimestamp: Date;
}
