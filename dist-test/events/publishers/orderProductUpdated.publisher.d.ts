import { Publisher, Subjects, OrderProductStockUpdatedEvent } from '../../common';
/**
 * OrderProductStockUpdated Publisher
 * OrderProduct'ların stok rezervasyon durumları güncellendiğinde bu publisher kullanılır
 */
export declare class OrderProductStockUpdatedPublisher extends Publisher<OrderProductStockUpdatedEvent> {
    subject: Subjects.OrderProductUpdated;
    publish(data: OrderProductStockUpdatedEvent['data']): Promise<void>;
}
//# sourceMappingURL=orderProductUpdated.publisher.d.ts.map