"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MARKETPLACE_SETTLEMENT_MAX_RECORDS_PER_EVENT = void 0;
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
 * GERIYE UYUMLULUK: yeni subject; kayit alanlarinin `id`, `transactionType` disindakileri isteğe
 * baglidir — ileride eklenecek alan tuketiciyi kirmaz.
 */
/** Olay basina en fazla kayit sayisi (yayinci boler). */
exports.MARKETPLACE_SETTLEMENT_MAX_RECORDS_PER_EVENT = 500;
//# sourceMappingURL=marketplace-settlements-fetched-event.js.map