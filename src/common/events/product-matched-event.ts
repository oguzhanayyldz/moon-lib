import { Subjects } from './subjects';

/**
 * ProductMatchedEvent
 *
 * Bu event SADECE stok rezervasyonu için kullanılır.
 * OrderProduct güncellemesi artık OrderUpdatedEvent ile yapılıyor.
 *
 * Refaktör sonrası:
 * - orderProductVersion ve productType alanları kaldırıldı
 * - Bu event'i SADECE Inventory servisi dinler
 * - Invoice ve Shipment artık OrderUpdatedEvent ile güncelleniyor
 */
export interface ProductMatchedEvent {
    subject: Subjects.ProductMatched;
    data: {
        orderId: string;
        orderProductId: string;
        productId: string;
        combinationId?: string;
        quantity: number;
        userId: string;
        canReserve: boolean;
        orderStatus: string;
        matchedAt: Date;
    };
}

export interface ProductMatched {
    orderId: string;
    orderProductId: string;
    productId: string;
    combinationId?: string;
    quantity: number;
    userId: string;
    canReserve: boolean;
    orderStatus: string;
    matchedAt: Date;
}