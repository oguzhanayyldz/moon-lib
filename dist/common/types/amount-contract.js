"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AMOUNT_CONTRACT_VERSION = exports.ORDER_DISCOUNT_BASES = exports.LINE_DISCOUNT_BASES = void 0;
exports.LINE_DISCOUNT_BASES = ['accounting', 'informational'];
exports.ORDER_DISCOUNT_BASES = ['in_lines', 'distribute', 'informational'];
exports.AMOUNT_CONTRACT_VERSION = 2;
