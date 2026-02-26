import { Publisher, Subjects, SubscriptionPaymentCompletedEvent } from '../../common';
export declare class SubscriptionPaymentCompletedPublisher extends Publisher<SubscriptionPaymentCompletedEvent> {
    subject: Subjects.SubscriptionPaymentCompleted;
    publish(data: SubscriptionPaymentCompletedEvent['data']): Promise<void>;
}
//# sourceMappingURL=subscriptionPaymentCompleted.publisher.d.ts.map