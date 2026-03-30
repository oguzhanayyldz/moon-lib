import { Publisher, Subjects, SubscriptionInvoiceCreatedEvent } from '../../common';
export declare class SubscriptionInvoiceCreatedPublisher extends Publisher<SubscriptionInvoiceCreatedEvent> {
    subject: Subjects.SubscriptionInvoiceCreated;
    publish(data: SubscriptionInvoiceCreatedEvent['data']): Promise<void>;
}
