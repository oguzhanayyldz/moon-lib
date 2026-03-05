import { Publisher, Subjects, SubscriptionPaymentFailedEvent } from '../../common';
export declare class SubscriptionPaymentFailedPublisher extends Publisher<SubscriptionPaymentFailedEvent> {
    subject: Subjects.SubscriptionPaymentFailed;
    publish(data: SubscriptionPaymentFailedEvent['data']): Promise<void>;
}
//# sourceMappingURL=subscriptionPaymentFailed.publisher.d.ts.map