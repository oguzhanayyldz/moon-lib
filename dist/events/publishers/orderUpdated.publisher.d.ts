import { Publisher, Subjects, OrderUpdatedEvent } from '../../common';
export declare class OrderUpdatedPublisher extends Publisher<OrderUpdatedEvent> {
    subject: Subjects.OrderUpdated;
    publish(data: OrderUpdatedEvent['data']): Promise<void>;
}
