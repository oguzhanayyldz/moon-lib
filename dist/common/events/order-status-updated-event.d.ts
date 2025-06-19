import { Subjects } from "./subjects";
import { OrderStatus } from "./types/order-status";
export interface OrderStatusUpdatedEvent {
    subject: Subjects.OrderStatusUpdated;
    data: {
        id: string;
        uuid: string;
        user: string;
        version: number;
        status: OrderStatus;
    };
}
