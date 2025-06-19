import { Subjects } from "./subjects";
import { ResourceName } from "../types/resourceName";
import { OrderIntegrationStatusUpdated } from "../interfaces/order-integration-status-updated.interface";
export interface OrderIntegrationStatusUpdatedEvent {
    subject: Subjects.OrderIntegrationStatusUpdated;
    data: {
        requestId: string;
        userId: string;
        orders: OrderIntegrationStatusUpdated[];
        source?: ResourceName;
        timestamp?: Date;
    };
}
//# sourceMappingURL=order-integration-status-updated-event.d.ts.map