export enum OrderStatus {
    // Initial states
    NewOrder = "newOrder",
    Comfirmed = "confirmed",
    Pending = "pending",

    // Processing States
    Processing = "processing",
    Preparing = "preparing",
    Prepared = "prepared",

    // Packaging states
    Packing = "packing",
    Packaged = "packaged",
    
    // Shipping states
    ReadyToShip = "readyToShip",
    Shipped = "shipped",
    InTransit= "inTransit",
    OutForDelivery = "outForDelivery",

    // Final states
    Delivered = "delivered",
    Completed = "completed",

    // Exception states
    Cancelled = "cancelled",
    Returned = "returned",
    Refunded = "refunded",
    Failed = "failed",
    
    // Hold states
    OnHold= "onHold",
    WaitingPayment = "waitingPayment",
    WaitingStock = "waitingStock",

    // Draft state
    Draft = "draft",
}

/**
 * Order status transitions mapping
 * Defines which status can transition to which other status
 */
export const ORDER_STATUS_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
    [OrderStatus.Draft]: [
        OrderStatus.NewOrder,
        OrderStatus.Cancelled
    ],
    [OrderStatus.NewOrder]: [
        OrderStatus.Comfirmed,
        OrderStatus.Cancelled,
        OrderStatus.WaitingPayment,
        OrderStatus.WaitingStock
    ],
    [OrderStatus.Comfirmed]: [
        OrderStatus.Processing,
        OrderStatus.OnHold,
        OrderStatus.Cancelled
    ],
    [OrderStatus.Processing]: [
        OrderStatus.Preparing,
        OrderStatus.OnHold,
        OrderStatus.Cancelled
    ],
    [OrderStatus.Preparing]: [
        OrderStatus.Prepared,
        OrderStatus.OnHold,
        OrderStatus.Cancelled
    ],
    [OrderStatus.Prepared]: [
        OrderStatus.Packing,
        OrderStatus.OnHold,
        OrderStatus.Cancelled
    ],
    [OrderStatus.Packing]: [
        OrderStatus.Packaged,
        OrderStatus.OnHold,
        OrderStatus.Cancelled
    ],
    [OrderStatus.Packaged]: [
        OrderStatus.ReadyToShip,
        OrderStatus.OnHold,
        OrderStatus.Cancelled
    ],
    [OrderStatus.ReadyToShip]: [
        OrderStatus.Shipped,
        OrderStatus.OnHold,
        OrderStatus.Cancelled
    ],
    [OrderStatus.Shipped]: [
        OrderStatus.InTransit,
        OrderStatus.Returned
    ],
    [OrderStatus.InTransit]: [
        OrderStatus.OutForDelivery,
        OrderStatus.Returned,
        OrderStatus.Failed
    ],
    [OrderStatus.OutForDelivery]: [
        OrderStatus.Delivered,
        OrderStatus.Returned,
        OrderStatus.Failed
    ],
    [OrderStatus.Delivered]: [
        OrderStatus.Completed,
        OrderStatus.Returned
    ],
    [OrderStatus.Completed]: [
        OrderStatus.Returned
    ],
    [OrderStatus.Cancelled]: [],
    [OrderStatus.Returned]: [
        OrderStatus.Refunded
    ],
    [OrderStatus.Refunded]: [],
    [OrderStatus.Failed]: [
        OrderStatus.Processing,
        OrderStatus.Cancelled
    ],
    [OrderStatus.OnHold]: [
        OrderStatus.Processing,
        OrderStatus.Cancelled
    ],
    [OrderStatus.WaitingPayment]: [
        OrderStatus.Comfirmed,
        OrderStatus.Cancelled
    ],
    [OrderStatus.WaitingStock]: [
        OrderStatus.Comfirmed,
        OrderStatus.Cancelled
    ]
};

/**
 * Check if a status transition is valid
 * @param fromStatus Current status
 * @param toStatus Target status
 * @returns Boolean indicating if transition is allowed
 */
export const isValidStatusTransition = (fromStatus: OrderStatus, toStatus: OrderStatus): boolean => {
    return ORDER_STATUS_TRANSITIONS[fromStatus]?.includes(toStatus) || false;
};

/**
 * Get next possible statuses for a given status
 * @param currentStatus Current order status
 * @returns Array of possible next statuses
 */
export const getNextPossibleStatuses = (currentStatus: OrderStatus): OrderStatus[] => {
    return ORDER_STATUS_TRANSITIONS[currentStatus] || [];
};

/**
 * Check if an order status indicates the order is active (not final)
 * @param status Order status to check
 * @returns Boolean indicating if order is active
 */
export const isActiveOrderStatus = (status: OrderStatus): boolean => {
    const finalStatuses = [
        OrderStatus.Completed,
        OrderStatus.Cancelled,
        OrderStatus.Refunded,
        OrderStatus.Failed
    ];
    return !finalStatuses.includes(status);
};

/**
 * Check if an order status indicates the order is in fulfillment process
 * @param status Order status to check
 * @returns Boolean indicating if order is being fulfilled
 */
export const isInFulfillmentProcess = (status: OrderStatus): boolean => {
    const fulfillmentStatuses = [
        OrderStatus.Processing,
        OrderStatus.Preparing,
        OrderStatus.Prepared,
        OrderStatus.Packing,
        OrderStatus.Packaged,
        OrderStatus.ReadyToShip,
        OrderStatus.Shipped,
        OrderStatus.InTransit,
        OrderStatus.OutForDelivery
    ];
    return fulfillmentStatuses.includes(status);
};