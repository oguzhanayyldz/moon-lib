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
        /** UC-1532: geçmiş aktarımı (backfill) işinden gelen parti; orders canlı alım gecikmesi metriğine katmaz. Yoksa canlı. */
        backfill?: boolean;
    };
}
