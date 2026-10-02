import { ResourceName } from "../types/resourceName";
import { Subjects } from "./subjects";
/**
 * Pazaryerinin "Eşleşen" (HB: PRE_MATCHED) ürün kararı durumu (TASK-MURHHI9UCDMZW).
 * - pending_approval     : platform kendi kataloğundaki bir ürünle eşleştirdi, satıcı kararı bekliyor
 * - auto_approved        : Moon "otomatik onayla" ayarıyla onayı platforma gönderdi
 * - approved / rejected  : kullanıcı Moon üzerinden elle onayladı / reddetti
 * - resolved_on_platform : önceki çekimde bekliyordu, artık platformda bekleyen listede değil
 *                          (ör. satıcı panelden karar verdi); sonucu integrationData.status gösterir
 */
export declare const PRODUCT_PRE_MATCH_STATUSES: readonly ["pending_approval", "auto_approved", "approved", "rejected", "resolved_on_platform"];
export type ProductPreMatchStatus = typeof PRODUCT_PRE_MATCH_STATUSES[number];
export type ProductPreMatchDecisionSource = 'auto' | 'user';
/** Olayı üreten akış — tanı/log içindir, tüketici davranışını değiştirmez */
export type ProductPreMatchTrigger = 'match_products' | 'tracking' | 'manual';
/**
 * Tek bir satıcı SKU'sunun eşleşme bilgisi. `merchantSku` Moon'un platforma gönderdiği stok kodudur
 * (catalog'da integrationData.id / platformCustomSku / ürün-kombinasyon SKU'su ile bulunur).
 * Platform alanları (platformSku, productName, brand, imageUrl, platformBarcode) platformun
 * "eşleştirdiği mevcut ürün" bilgisidir — kullanıcı kararı bunlara bakarak verir.
 */
export interface ProductPreMatchItem {
    merchantSku: string;
    status: ProductPreMatchStatus;
    /** Ürün Moon tarafından platforma gönderildiyse true (otomatik onay yalnız bunlara uygulanır) */
    sentByMoon: boolean;
    platformSku?: string;
    productName?: string;
    brand?: string;
    imageUrl?: string;
    /** Moon'un gönderdiği barkod */
    barcode?: string;
    /** Platformun eşleştirdiği ürünün barkodu (yanıtta varsa) */
    platformBarcode?: string;
    decidedBy?: ProductPreMatchDecisionSource;
    /** Son onay/red denemesi başarısızsa kısa, müşteri verisi içermeyen hata özeti */
    lastError?: string;
}
/**
 * ProductPreMatchUpdated (TASK-MURHHI9UCDMZW)
 *
 * Entegrasyon servisi → catalog: "Eşleşen" ürünlerin eşleşme verisi ve karar durumu.
 * CatalogMapping catalog'a NATIVE'dir; entegrasyon yalnız bu olayı yayınlar, yazımı catalog yapar.
 *
 * `observedAt` sıralama koruması içindir: catalog daha eski gözlemle daha yeni kaydı ezmez.
 * `pendingSnapshot` yalnız TAM çekimde (matchProducts) gelir ve o anda platformda bekleyen TÜM
 * SKU'ları listeler; catalog bu listede olmayan eski "pending_approval" kayıtlarını
 * "resolved_on_platform" yapar. Kısmi akışlar (tracking, manual) bu alanı göndermez.
 */
export interface ProductPreMatchUpdatedEvent {
    subject: Subjects.ProductPreMatchUpdated;
    data: {
        userId: string;
        source: ResourceName;
        observedAt: string;
        trigger: ProductPreMatchTrigger;
        items: ProductPreMatchItem[];
        pendingSnapshot?: {
            merchantSkus: string[];
        };
    };
}
//# sourceMappingURL=product-pre-match-updated-event.d.ts.map