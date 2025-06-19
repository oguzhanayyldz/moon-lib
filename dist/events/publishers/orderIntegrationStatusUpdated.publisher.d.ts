import { Publisher, Subjects, OrderIntegrationStatusUpdatedEvent } from '../../common';
export declare class OrderIntegrationStatusUpdatedPublisher extends Publisher<OrderIntegrationStatusUpdatedEvent> {
    subject: Subjects.OrderIntegrationStatusUpdated;
    publish(data: OrderIntegrationStatusUpdatedEvent['data']): Promise<void>;
}
