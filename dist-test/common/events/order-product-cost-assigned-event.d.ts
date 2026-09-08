import { Subjects } from "./subjects";
import { CostSource } from "../types/cost-source";
/**
 * Siparis kaleminin maliyeti atandi (issue #683, epic #677 Faz C)
 *
 * Yayinlayan: inventory — `orderCreated` listener'i rezervasyon yaptiktan sonra maliyet
 * katmanlarini tuketir ve tuketilen agirlikli birim maliyeti bu event ile tasir.
 * Dinleyen:   orders — `OrderProduct.costPrice/costTotal/costSource` yazar.
 *
 * NEDEN INVENTORY HESAPLIYOR: maliyet katmanlari (`CostLayer`) inventory'ye NATIVE'dir
 * ve tuketim rezervasyonla ayni anda, ayni islemde yapilmalidir — yoksa iki siparis ayni
 * katmani gorup ayni mali iki kez satilmis gosterir. Orders oraya erisemez (Kural 2).
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
    };
}
//# sourceMappingURL=order-product-cost-assigned-event.d.ts.map