import { Publisher, Subjects, OrderCreatedEvent } from '../../common';
export declare class OrderCreatedPublisher extends Publisher<OrderCreatedEvent> {
    subject: Subjects.OrderCreated;
    publish(data: OrderCreatedEvent['data']): Promise<void>;
}
//# sourceMappingURL=orderCreated.publisher.d.ts.map