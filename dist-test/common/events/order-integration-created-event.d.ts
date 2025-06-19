import { Subjects } from "./subjects";
import { ResourceName } from "../types/resourceName";
import { OrderIntegrationCreated } from "../interfaces/order-integration-created.interface";
export interface OrderIntegrationCreatedEvent {
    subject: Subjects.OrderIntegrationCreated;
    data: {
        requestId: string;
        userId: string;
        orders: OrderIntegrationCreated[];
        source?: ResourceName;
        timestamp?: Date;
    };
}
//# sourceMappingURL=order-integration-created-event.d.ts.map