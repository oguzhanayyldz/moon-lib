export declare enum OrderStatus {
    NewOrder = "newOrder",
    Comfirmed = "confirmed",
    Pending = "pending",
    Paid = "paid",
    Processing = "processing",
    Preparing = "preparing",
    Prepared = "prepared",
    Packing = "packing",
    Packaged = "packaged",
    ReadyToShip = "readyToShip",
    Shipped = "shipped",
    InTransit = "inTransit",
    OutForDelivery = "outForDelivery",
    Delivered = "delivered",
    Completed = "completed",
    Cancelled = "cancelled",
    Returned = "returned",
    Refunded = "refunded",
    Failed = "failed",
    OnHold = "onHold",
    WaitingPayment = "waitingPayment",
    WaitingStock = "waitingStock",
    Draft = "draft"
}
/**
 * Order status transitions mapping
 * Defines which status can transition to which other status
 */
export declare const ORDER_STATUS_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>>;
/**
 * Check if a status transition is valid
 * @param fromStatus Current status
 * @param toStatus Target status
 * @returns Boolean indicating if transition is allowed
 */
export declare const isValidStatusTransition: (fromStatus: OrderStatus, toStatus: OrderStatus) => boolean;
/**
 * Get next possible statuses for a given status
 * @param currentStatus Current order status
 * @returns Array of possible next statuses
 */
export declare const getNextPossibleStatuses: (currentStatus: OrderStatus) => OrderStatus[];
/**
 * Check if an order status indicates the order is active (not final)
 * @param status Order status to check
 * @returns Boolean indicating if order is active
 */
export declare const isActiveOrderStatus: (status: OrderStatus) => boolean;
/**
 * Check if an order status indicates the order is in fulfillment process
 * @param status Order status to check
 * @returns Boolean indicating if order is being fulfilled
 */
export declare const isInFulfillmentProcess: (status: OrderStatus) => boolean;
//# sourceMappingURL=order-status.d.ts.map