import { Subjects } from "./subjects";
import { IntegrationLimits } from "../types/integration-limits";
import { CronDefaults } from "../types/cron-defaults";

export interface SubscriptionUpdatedEvent {
    subject: Subjects.SubscriptionUpdated;
    data: {
        action: "created" | "plan_changed" | "addon_changed" | "cancelled" | "renewed" | "expired" | "trial_started" | "trial_expiring" | "trial_expired" | "trial_converted" | "addon_expired" | "limits_enforced";
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
        addons: Array<{ type: string; value: number; quantity: number; integrationGroup?: string }>;
        status: "active" | "trial" | "past_due" | "cancelled" | "expired";
        currentPeriodStart?: Date;
        currentPeriodEnd: Date;
        workPackagesEnabled?: boolean;
        cronCustomizationEnabled?: boolean;
        cronDefaults?: CronDefaults;
    };
}
