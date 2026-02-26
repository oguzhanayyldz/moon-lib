import { Publisher, Subjects, SubscriptionUpdatedEvent } from '../../common';
export declare class SubscriptionUpdatedPublisher extends Publisher<SubscriptionUpdatedEvent> {
    subject: Subjects.SubscriptionUpdated;
    publish(data: SubscriptionUpdatedEvent['data']): Promise<void>;
}
