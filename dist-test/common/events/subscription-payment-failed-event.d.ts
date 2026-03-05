import { Subjects } from "./subjects";
export interface SubscriptionPaymentFailedEvent {
    subject: Subjects.SubscriptionPaymentFailed;
    data: {
        paymentId: string;
        userId: string;
        subscriptionId: string;
        amount: number;
        currency: string;
        failureReason: string;
        attemptCount: number;
    };
}
//# sourceMappingURL=subscription-payment-failed-event.d.ts.map