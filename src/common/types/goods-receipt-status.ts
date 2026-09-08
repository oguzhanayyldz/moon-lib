/**
 * Mal kabul belgesinin durumu (issue #684, epic #677 Faz D).
 *
 * NEDEN DURUM MAKINESI GEREKLI: Faz D oncesinde alis faturasi TEK ADIMDA yaziliyordu —
 * belge olusur, ayni anda stok artar ve maliyet katmani uretilirdi. Bu kurguda
 * "beklenen ne, gelen ne, red ne" sorusunun cevabi hicbir yerde tutulmuyordu: siparis
 * edilen 100 adetten 60'i geldiyse belge yine 60 yazip kapaniyor, eksik 40 adet
 * kaybolyordu. Kullanicinin ifadesiyle: "gercekten gelen urunler kusursuz sekilde
 * stoklara girdi mi bilmeliyiz."
 *
 * AKIS:
 *   draft     → talep listesi hazirlanir (tedarikci, belge no, beklenen kalemler).
 *               Stok ARTMAZ, katman URETILMEZ — mal henuz gelmemistir.
 *   receiving → ilk kabul satiri islendiginde girilir. Her kabul ANINDA stok + katman
 *               uretir; kismi kabul desteklenir, belge acik kalir.
 *   closed    → kapanis. Kalan beklenen miktar "gelmedi" olarak raporlanir ve belge
 *               kilitlenir; sonrasinda kalem eklenemez/degistirilemez.
 *   cancelled → belge iptal edildi. Kabul edilmis satirlar varsa stok/katman geri alinir.
 *
 * ESKI KAYITLAR `closed` SAYILIR: sema varsayilani bilerek `Closed`'dur. Faz D oncesi
 * yazilmis faturalarda bu alan yoktur ve onlarin mali ZATEN girmistir — varsayilan
 * `Draft` olsaydi tamami "mal beklaniyor" gorunur, listeler ve raporlar bozulurdu.
 * Yeni talep listeleri durumu ACIKCA `Draft` yazar.
 */
export enum GoodsReceiptStatus {
    /** Talep listesi hazirlaniyor — stok ve katman YOK */
    Draft = 'draft',
    /** En az bir kalem kabul edildi; belge hala acik, kismi kabul surebilir */
    Receiving = 'receiving',
    /** Kapandi — kalan beklenen "gelmedi" sayilir, belge kilitli */
    Closed = 'closed',
    /** Iptal edildi */
    Cancelled = 'cancelled'
}

/**
 * Belge bu durumdayken kalem eklenebilir/degistirilebilir mi?
 *
 * Tek bir yerde tanimlanir cunku bu kontrol hem kabul ucunda, hem kapanis ucunda,
 * hem de silme akisinda gerekiyor — uc ayri yerde tekrar yazilirsa biri gunun birinde
 * unutulur ve kapanmis belge sessizce degisir.
 */
export const isGoodsReceiptEditable = (status?: GoodsReceiptStatus | string): boolean =>
    status === GoodsReceiptStatus.Draft || status === GoodsReceiptStatus.Receiving;
