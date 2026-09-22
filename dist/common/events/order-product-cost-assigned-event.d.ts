import { Subjects } from "./subjects";
import { CostSource } from "../types/cost-source";
/**
 * Siparis kaleminin maliyeti atandi (issue #683, epic #677 Faz C; MALIYET-MS1-SIPARIS-ANI
 * ile genisledi, D5-B)
 *
 * Yayinlayan: inventory — `CostLayerService`/`CostAssignmentService` katmanlari tuketir/iade
 * eder ve kumulatif agirlikli birim maliyeti bu event ile tasir.
 * Dinleyen:   orders — `OrderProduct.costPrice/costTotal/costSource` yazar.
 *
 * NEDEN INVENTORY HESAPLIYOR: maliyet katmanlari (`CostLayer`) inventory'ye NATIVE'dir.
 * Orders oraya erisemez (Kural 2).
 *
 * TUKETIM ANI `COST_AT_ORDER_MODE`'a BAGLIDIR (varsayilan `reservation`, MS-1 oncesi
 * davranis): `reservation` modunda tuketim rezervasyonla AYNI ANDA yapilir — arada gelen
 * baska bir siparis ayni katmani gorup mali iki kez satilmis gostermesin diye. `order`
 * modunda (patron acar) tuketim SIPARISIN MUTLAK HEDEF adedine baglidir ve rezervasyondan
 * TAMAMEN BAGIMSIZDIR (stok olmasa da hedef doludur, M4 Faz 1 gecici deger devreye girer);
 * iptal/iade hedefi dusurur ve bu event'i tekrar (kumulatif, dusuk deger ya da 0 ile) tasir.
 *
 * NEDEN SIPARIS ANINDA DONDURULUYOR: `unitCost` bu event'le yazildiktan sonra sonraki
 * alislar onu DEGISTIRMEZ. Muhasebe dogrulugu: satilan malin maliyeti satis anindaki
 * maliyettir; sonradan gelen bir fatura gecmis karlari yeniden yazmamalidir.
 */
export interface OrderProductCostAssignedEvent {
    subject: Subjects.OrderProductCostAssigned;
    data: {
        user: string;
        order: string;
        orderProduct: string;
        /** Tuketilen katmanlarin AGIRLIKLI birim maliyeti (adet birden fazla katmana yayilabilir) */
        unitCost: number;
        /** `unitCost x tuketilenMiktar` — orders tarafinda yeniden hesaplanmaz */
        costTotal: number;
        /** Fiilen tuketilen miktar; stok yetmediyse istenen miktardan AZ olabilir */
        quantity: number;
        /** Bu maliyetin kaynagi — orders `canOverrideCost` ile karsilastirir */
        source: CostSource;
        /** Tuketilen katmanlarin id'leri — denetim izi ve iade icin */
        layerIds: string[];
        /**
         * Kalem basina MONOTON artan sira numarasi (opsiyonel, additive — MALIYET-MS2).
         *
         * Bir kaleme art arda birden cok KUMULATIF olay yayinlanabilir (tuketim, iade,
         * duzeltme). Yayinci her olayda bir oncekinden buyuk bir deger tasir; tuketici
         * bunu iki isten icin kullanir:
         *  1. Kilit anahtarina katar — kilit surerken gelen YENI olay ack'lenip dusmez.
         *  2. Kalemde saklar — sirasi bozuk gelen ESKI olay (sequence <= saklanan) yeniyi ezmez.
         *
         * Alan YOKSA (bugunku yayinci) tuketici eski davranisla calisir; sozlesme kirilmaz.
         */
        sequence?: number;
    };
}
