import { Subjects } from "./subjects";
/**
 * OrderProductStockUpdated Event
 * Bu event OrderProduct'ların stok rezervasyon durumları güncellendiğinde yayınlanır
 * Özellikle Inventory servisi tarafından kısmi rezervasyon durumlarında kullanılır
 */
export interface OrderProductStockUpdatedEvent {
    subject: Subjects.OrderProductUpdated;
    data: OrderProductStockUpdatedEventData;
}
export interface OrderProductStockUpdatedEventData {
    id: string;
    uuid: string;
    user: string;
    order: string;
    version: number;
    stockReserved: number;
    stockShortage: boolean;
    stockShortageAmount: number;
    stockShortageResolvedAt?: Date;
    product?: string;
    combination?: string;
    quantity: number;
    sku: string;
    barcode: string;
    name: string;
}
//# sourceMappingURL=order-product-updated-event.d.ts.map