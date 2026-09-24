/**
 * Siparis TUTAR SOZLESMESI v2 (INDIRIM-SOZLESMESI-TASARIM §4.2, TASK-MUFIZL0JQ36OM).
 *
 * NEDEN GEREKLI: kalem `discountTotal` bazi platformlarda odenen tutardan dusulen muhasebe
 * indirimi, bazilarinda yalniz bilgi; siparis `discountTotal` ise kalemlerin toplami, dagitilacak
 * kupon ya da hesap kalintisi olabiliyor. Bu anlami her okuyucu (fatura, kismi iade, rapor) kendi
 * basina platform listesiyle tahmin ediyordu. v2'de anlam URETICI SINIRINDA (OrderIntegrationCreated)
 * beyan edilir, orders onu TEK noktada kanonik bicime cevirir ve siparise `amountContract` isareti yazar.
 *
 * Kanonik (v2) degismezler — isaretli sipariste her okuyucu bunlara guvenir:
 * - kalem `discountTotal` HER ZAMAN muhasebe indirimidir; birim `discount` yalniz gosterimdir;
 * - siparis `discountTotal` = Σ kalem `discountTotal`;
 * - `total` = Σ(adet × price − kalem discountTotal) + kargo.
 *
 * Alanlar su an OPSIYONEL: beyan etmeyen uretici ve isaretsiz (eski) siparis v1 kurallariyla aynen
 * islenir. Tum uretici beyanlari tamamlaninca zorunlu yapilacak (tasarim §4.4 emeklilik, S3).
 */
/**
 * Kalem indiriminin anlami.
 * - `accounting`   : odenen satir = adet × price − discountTotal (price BRUT, indirimsiz birim)
 * - `informational`: price zaten odenen birim; discount / discountTotal yalniz bilgi (tutara girmez)
 */
export type LineDiscountBasis = 'accounting' | 'informational';
/**
 * Siparis `discountTotal`'inin anlami.
 * - `in_lines`     : siparis discountTotal = Σ kalem (indirim kalemlerde zaten var)
 * - `distribute`   : siparis indirimi kalemlerde YOK; kalemlere dagitilacak (kupon)
 * - `informational`: hesap kalintisi / bilgi; tutara girmez
 */
export type OrderDiscountBasis = 'in_lines' | 'distribute' | 'informational';
export declare const LINE_DISCOUNT_BASES: ReadonlyArray<LineDiscountBasis>;
export declare const ORDER_DISCOUNT_BASES: ReadonlyArray<OrderDiscountBasis>;
export declare const AMOUNT_CONTRACT_VERSION: 2;
/**
 * Siparise orders'in yazdigi sozlesme isareti; OrderCreated / OrderUpdated ile tasinir.
 * Isaret YOKSA kayit v1'dir (eski kurallar, platform listeleri).
 */
export interface AmountContract {
    version: typeof AMOUNT_CONTRACT_VERSION;
    lineDiscountBasis: LineDiscountBasis;
    orderDiscountBasis: OrderDiscountBasis;
    /**
     * `orderDiscountBasis = 'informational'` iken uretici siparis indirimi olarak gonderdigi ama
     * tutara girmeyen deger (bilgi). Siparis `discountTotal`'i bu durumda Σ kalem'dir.
     */
    infoOrderDiscount?: number;
}
//# sourceMappingURL=amount-contract.d.ts.map