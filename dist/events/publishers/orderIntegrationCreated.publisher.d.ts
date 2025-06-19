import { Publisher, Subjects, OrderIntegrationCreatedEvent } from '../../common';
export declare class OrderIntegrationCreatedPublisher extends Publisher<OrderIntegrationCreatedEvent> {
    subject: Subjects.OrderIntegrationCreated;
    publish(data: OrderIntegrationCreatedEvent['data']): Promise<void>;
}
