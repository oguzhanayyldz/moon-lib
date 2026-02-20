import { Subjects } from "./subjects";
import { OrderStatus } from "./types/order-status";
import { OrderStatus2 } from "./types/order-status2";

export interface OrderStatusUpdatedEvent {
    subject: Subjects.OrderStatusUpdated;
    data: {
        id: string;
        uuid: string;
        user: string;
        version: number;
        status: OrderStatus;
        status2?: OrderStatus2;
    };
}