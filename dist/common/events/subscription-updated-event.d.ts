import { Subjects } from "./subjects";
export interface SubscriptionUpdatedEvent {
    subject: Subjects.SubscriptionUpdated;
    data: {
        action: "created" | "plan_changed" | "addon_changed" | "cancelled" | "renewed" | "expired";
        subscriptionId: string;
        userId: string;
        planId: string;
        planSlug: string;
        limits: {
            integrationLimit: number;
            orderLimit: number;
            productLimit: number;
            subUserLimit: number;
            warehouseLimit: number;
        };
        addons: Array<{
            type: string;
            value: number;
            quantity: number;
        }>;
        status: "active" | "trial" | "past_due" | "cancelled" | "expired";
        currentPeriodEnd: Date;
    };
}
