import { Publisher, Subjects, OrderStatusUpdatedEvent } from '../../common';
export declare class OrderStatusUpdatedPublisher extends Publisher<OrderStatusUpdatedEvent> {
    subject: Subjects.OrderStatusUpdated;
    publish(data: OrderStatusUpdatedEvent['data']): Promise<void>;
}
//# sourceMappingURL=orderStatusUpdated.publisher.d.ts.map