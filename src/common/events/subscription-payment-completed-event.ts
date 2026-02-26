import { Subjects } from "./subjects";

export interface SubscriptionPaymentCompletedEvent {
    subject: Subjects.SubscriptionPaymentCompleted;
    data: {
        paymentId: string;
        userId: string;
        subscriptionId: string;
        amount: number;
        currency: string;
        billingPeriodStart: Date;
        billingPeriodEnd: Date;
    };
}
