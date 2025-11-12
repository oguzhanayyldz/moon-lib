import { Subjects } from "./subjects";

export interface NotificationCreatedEvent {
    subject: Subjects.NotificationCreated;
    data: {
        userId: string;
        type: "order" | "integration" | "stock" | "system" | "security";
        category: string;
        title: string;
        message: string;
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
