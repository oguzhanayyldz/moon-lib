import { Subjects } from "./subjects";
import { IntegrationLimits } from "../types/integration-limits";
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
            integrationLimits?: IntegrationLimits;
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
        currentPeriodStart?: Date;
        currentPeriodEnd: Date;
    };
}
//# sourceMappingURL=subscription-updated-event.d.ts.map