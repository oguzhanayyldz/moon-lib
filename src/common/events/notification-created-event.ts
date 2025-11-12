import { Subjects } from "./subjects";

export interface NotificationCreatedEvent {
    subject: Subjects.NotificationCreated;
    data: {
        userId: string;
        type: "order" | "integration" | "stock" | "system" | "security";
        category: string;
        // Legacy fields (optional for backward compatibility)
        title?: string;
        message?: string;
        // Translation key fields (preferred method)
        titleKey?: string;
        titleParams?: Record<string, any>;
        messageKey?: string;
        messageParams?: Record<string, any>;
        metadata?: {
            orderId?: string;
            integrationId?: string;
            productId?: string;
            severity?: "info" | "success" | "warning" | "error";
            actionUrl?: string;
            additionalData?: any;
        };
    };
}
