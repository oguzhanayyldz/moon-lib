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
        billingInfo?: {
            companyName?: string;
            taxNumber?: string;
            taxOffice?: string;
            name?: string;
            surname?: string;
            email?: string;
            phone?: string;
            address?: {
                line1?: string;
                line2?: string;
                city?: string;
                district?: string;
                postalCode?: string;
                country?: string;
            };
        };
    };
}
//# sourceMappingURL=subscription-payment-completed-event.d.ts.map