import { Subjects } from "./subjects";

/**
 * Pazaryeri hakedis (settlement) kayitlari cekildi (UC-1688, issue #693 Faz 6 — yalniz komisyon).
 *
 * Yayinlayan: pazaryeri entegrasyon servisi (bugun yalniz trendyol) — finans API'sinden periyodik
 *             cekilen YENI ham kayitlari tasir. Ham kayitlar yayincida `id` ile idempotent saklanir;
 *             ayni kayit ikinci kez cekilirse yeniden yayinlanmaz.
 * Dinleyen:   orders — kayitlari kaleme esler, kalem komisyonunu ilgili TUM kayitlardan
 *             KUMULATIF turetir (`commissionSource = marketplace`), tahmini (estimate) ezer,
 *             manuel'i korur (`canOverrideCost`).
 *
 * SOZLESME (Trendyol canli olcumu, UC-1679):
 * - Satilan her BIRIM icin tek kayit; adet alani yoktur.
 * - `transactionType` platformun HAM etiketidir (Trendyol: 'Satış' | 'İade' | 'İndirim' | 'Kupon').
 *   Normallestirme tuketicide yapilir; bilinmeyen etiket sessizce atilmaz, tuketici sayar.
 * - Tutar her zaman POZITIFTIR, yonu `direction` tasir: 'credit' (Satış) | 'debt' (digerleri).
 * - `commissionAmount` her tipte POZITIFTIR. Kalem net komisyonu =
 *   Σ Satış.kom − Σ İndirim.kom − Σ Kupon.kom (iade ayrica degerlendirilir).
 * - Eslesme: Satış/İndirim/Kupon → `shipmentPackageId` (= Order.platformNumber) + `barcode`;
 *   İade → `orderNumber` + `barcode` (iade paketi satis paketinden farklidir).
 * - `orderLineItemId` siparis API'sindeki `lineId` ile AYNI kimlik DEGILDIR; yalniz ayni birimin
 *   Satış/İndirim/Kupon kayitlarini birbirine baglar.
 *
 * TESLIMAT: en fazla `MARKETPLACE_SETTLEMENT_MAX_RECORDS_PER_EVENT` kayit/olay. Ayni kayit
 * (ayni `id`) yeniden teslimde ya da geriye donuk taramada tekrar gelebilir; tuketici `id` ile
 * upsert ETMELIDIR (toplam sismez). Kayitlarin sirasi garanti degildir.
 *
 * SIPARIS DUZEYI KAYIT (UC-1699, Pazarama paymentAgreement — olcum UC-1698):
 * - `level: 'order'` → kayit SIPARIS basinadir; barcode/shipmentPackageId YOKTUR.
 *   Eslesme `orderId` (= Order.platformNumber) ile; kalem dagitimi tuketicidedir.
 * - Pazarama: `trxId` satir basina TEKIL DEGIL (ayni siparisin Satış ve İade satiri ayni trxId'yi
 *   tasiyor, UC-1698 olcumu). `id` bilesiktir: `<trxId>:<status>:<YYYY-MM-DD>:<|amount| kurus>#<n>`
 *   (n = ayni yanitta ayni tabanin sira no'su). Tuketici yine yalniz `id` ile upsert eder.
 *   `transactionType` ham 'Satış' | 'İade'; `amount` ve `commissionAmount`
 *   yine POZITIF (ham isaret atilir), yon `direction` ('Satış' → credit, 'İade' → debt).
 *   Siparis net komisyonu = Σ Satış.kom − Σ İade.kom. Stopaj / entegrasyon bedeli olaya GIRMEZ.
 * - `level` yoksa 'unit' sayilir (Trendyol, geriye uyumlu).
 *
 * GERIYE UYUMLULUK: yeni subject; kayit alanlarinin `id`, `transactionType` disindakileri isteğe
 * baglidir — ileride eklenecek alan tuketiciyi kirmaz.
 */

/** Olay basina en fazla kayit sayisi (yayinci boler). */
export const MARKETPLACE_SETTLEMENT_MAX_RECORDS_PER_EVENT = 500;

/** Tutar yonu: saticiya alacak (Satış) ya da saticidan kesinti (İade/İndirim/Kupon). */
export type MarketplaceSettlementDirection = 'credit' | 'debt';

/** Kayit duzeyi: 'unit' = satilan birim (Trendyol), 'order' = siparis (Pazarama). Yoksa 'unit'. */
export type MarketplaceSettlementLevel = 'order' | 'unit';

export interface MarketplaceSettlementRecord {
    /** Platformda tekil kayit kimligi — upsert anahtari (Trendyol `id`) */
    id: string;
    /** HAM platform etiketi (Trendyol: 'Satış' | 'İade' | 'İndirim' | 'Kupon') */
    transactionType: string;
    /** Kayit duzeyi; yoksa 'unit' (UC-1699) */
    level?: MarketplaceSettlementLevel;
    /** level='order': platform siparis kimligi (= Order.platformNumber), string (UC-1699) */
    orderId?: string;
    /** Pozitif tutar (Trendyol: credit ya da debt alanindaki deger) */
    amount?: number;
    direction?: MarketplaceSettlementDirection;
    /** Pozitif komisyon tutari (KDV dahil net × oran) */
    commissionAmount?: number;
    /** Yuzde, ör. 2.8 */
    commissionRate?: number;
    /** Pozitif; amount − commissionAmount */
    sellerRevenue?: number;
    /** Satis paketi (= Order.platformNumber); İade'de iade paketidir ya da yoktur */
    shipmentPackageId?: string;
    orderNumber?: string;
    barcode?: string;
    /** Birim kimligi; siparis `lineId`'si DEGIL */
    orderLineItemId?: string;
    /** Epoch ms */
    transactionDate?: number;
    /** Epoch ms */
    orderDate?: number;
    currency?: string;
}

export interface MarketplaceSettlementsFetchedEvent {
    subject: Subjects.MarketplaceSettlementsFetched;
    data: {
        /** Moon kullanici (kiraci) id'si */
        user: string;
        /** Moon Integration id'si (komut yukunden; yoksa bos) */
        integration?: string;
        /** ResourceName değeri, ör. 'Trendyol' (tüketici büyük/küçük harf duyarsız karşılaştırmalı) */
        platform: string;
        records: MarketplaceSettlementRecord[];
        /** Bu kayitlari getiren cekim penceresi (epoch ms) — denetim izi */
        windowStart?: number;
        windowEnd?: number;
        /** ISO zaman */
        fetchedAt?: string;
    };
}
