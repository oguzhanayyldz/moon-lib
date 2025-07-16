import { Subjects } from './subjects';
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
//# sourceMappingURL=product-matched-event.d.ts.map