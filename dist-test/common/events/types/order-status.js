"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSkippedStatuses = exports.isForwardCargoTransition = exports.ORDER_STATUS_PRIORITY = exports.isInFulfillmentProcess = exports.isActiveOrderStatus = exports.getNextPossibleStatuses = exports.isValidStatusTransition = exports.ORDER_STATUS_TRANSITIONS = exports.OrderStatus = void 0;
var OrderStatus;
(function (OrderStatus) {
    // Initial states
    OrderStatus["NewOrder"] = "newOrder";
    OrderStatus["Comfirmed"] = "confirmed";
    OrderStatus["Pending"] = "pending";
    // Processing States
    OrderStatus["Paid"] = "paid";
    OrderStatus["Processing"] = "processing";
    OrderStatus["Preparing"] = "preparing";
    OrderStatus["Prepared"] = "prepared";
    // Packaging states
    OrderStatus["Packing"] = "packing";
    OrderStatus["Packaged"] = "packaged";
    // Shipping states
    OrderStatus["ReadyToShip"] = "readyToShip";
    OrderStatus["Shipped"] = "shipped";
    OrderStatus["InTransit"] = "inTransit";
    OrderStatus["OutForDelivery"] = "outForDelivery";
    // Final states
    OrderStatus["Delivered"] = "delivered";
    OrderStatus["Completed"] = "completed";
    // Exception states
    OrderStatus["Cancelled"] = "cancelled";
    OrderStatus["Returned"] = "returned";
    OrderStatus["Refunded"] = "refunded";
    OrderStatus["Failed"] = "failed";
    // Hold states
    OrderStatus["OnHold"] = "onHold";
    OrderStatus["WaitingPayment"] = "waitingPayment";
    OrderStatus["WaitingStock"] = "waitingStock";
    // Draft state
    OrderStatus["Draft"] = "draft";
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
/**
 * Order status transitions mapping
 * Defines which status can transition to which other status
 */
exports.ORDER_STATUS_TRANSITIONS = {
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
        OrderStatus.Paid,
        OrderStatus.Processing,
        OrderStatus.OnHold,
        OrderStatus.Cancelled
    ],
    [OrderStatus.Paid]: [
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
        OrderStatus.Shipped, // Hızlı hazırlık, direkt gönderim
        OrderStatus.InTransit, // Express senaryolar
        OrderStatus.OnHold,
        OrderStatus.Cancelled
    ],
    [OrderStatus.Prepared]: [
        OrderStatus.Packing,
        OrderStatus.Shipped, // Kargo oluşturulup gönderildiğinde
        OrderStatus.InTransit, // Kargo firması direkt in_transit döndüğünde
        OrderStatus.OnHold,
        OrderStatus.Cancelled
    ],
    [OrderStatus.Packing]: [
        OrderStatus.Packaged,
        OrderStatus.Shipped, // Paketlenip direkt gönderiliyor
        OrderStatus.InTransit, // Paketlenir paketlenmez kargoya verildi
        OrderStatus.OnHold,
        OrderStatus.Cancelled
    ],
    [OrderStatus.Packaged]: [
        OrderStatus.ReadyToShip,
        OrderStatus.Shipped, // Paketlendi ve gönderildi
        OrderStatus.InTransit, // Direkt yolda
        OrderStatus.OnHold,
        OrderStatus.Cancelled
    ],
    [OrderStatus.ReadyToShip]: [
        OrderStatus.Shipped,
        OrderStatus.InTransit, // Kargo alır almaz yola çıktı
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
        OrderStatus.Paid,
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
const isValidStatusTransition = (fromStatus, toStatus) => {
    var _a;
    return ((_a = exports.ORDER_STATUS_TRANSITIONS[fromStatus]) === null || _a === void 0 ? void 0 : _a.includes(toStatus)) || false;
};
exports.isValidStatusTransition = isValidStatusTransition;
/**
 * Get next possible statuses for a given status
 * @param currentStatus Current order status
 * @returns Array of possible next statuses
 */
const getNextPossibleStatuses = (currentStatus) => {
    return exports.ORDER_STATUS_TRANSITIONS[currentStatus] || [];
};
exports.getNextPossibleStatuses = getNextPossibleStatuses;
/**
 * Check if an order status indicates the order is active (not final)
 * @param status Order status to check
 * @returns Boolean indicating if order is active
 */
const isActiveOrderStatus = (status) => {
    const finalStatuses = [
        OrderStatus.Completed,
        OrderStatus.Cancelled,
        OrderStatus.Refunded,
        OrderStatus.Failed
    ];
    return !finalStatuses.includes(status);
};
exports.isActiveOrderStatus = isActiveOrderStatus;
/**
 * Check if an order status indicates the order is in fulfillment process
 * @param status Order status to check
 * @returns Boolean indicating if order is being fulfilled
 */
const isInFulfillmentProcess = (status) => {
    const fulfillmentStatuses = [
        OrderStatus.Paid,
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
exports.isInFulfillmentProcess = isInFulfillmentProcess;
/**
 * Order status priority mapping for cargo-based transitions
 * Higher number = later in fulfillment process
 * Used to determine if a status transition is "forward" or "backward"
 */
exports.ORDER_STATUS_PRIORITY = {
    // Initial states (0-9)
    [OrderStatus.Draft]: 0,
    [OrderStatus.NewOrder]: 1,
    [OrderStatus.WaitingPayment]: 2,
    [OrderStatus.WaitingStock]: 3,
    [OrderStatus.Comfirmed]: 4,
    [OrderStatus.Paid]: 5,
    // Processing States (10-19)
    [OrderStatus.Pending]: 10,
    [OrderStatus.Processing]: 11,
    [OrderStatus.Preparing]: 12,
    [OrderStatus.Prepared]: 13,
    // Packaging states (20-29)
    [OrderStatus.Packing]: 20,
    [OrderStatus.Packaged]: 21,
    // Shipping states (30-49)
    [OrderStatus.ReadyToShip]: 30,
    [OrderStatus.Shipped]: 35,
    [OrderStatus.InTransit]: 40,
    [OrderStatus.OutForDelivery]: 45,
    // Delivery states (50-59)
    [OrderStatus.Delivered]: 50,
    [OrderStatus.Completed]: 55,
    // Exception states (100+) - considered "final" or "terminal"
    [OrderStatus.OnHold]: 100,
    [OrderStatus.Cancelled]: 101,
    [OrderStatus.Returned]: 102,
    [OrderStatus.Refunded]: 103,
    [OrderStatus.Failed]: 104,
};
/**
 * Final/terminal order statuses that cannot be changed (except for specific cases)
 */
const FINAL_STATUSES = [
    OrderStatus.Completed,
    OrderStatus.Cancelled,
    OrderStatus.Refunded,
    OrderStatus.Failed
];
/**
 * Check if a status transition is valid for cargo-based updates
 *
 * This is different from isValidStatusTransition() because:
 * - Allows "forward" jumps (e.g., Prepared → Delivered)
 * - Blocks backward transitions (e.g., Delivered → Preparing)
 * - Prevents exiting from final statuses
 *
 * Used specifically for ShipmentUpdated events where cargo company
 * reports the real-world status, which may skip intermediate states.
 *
 * @param fromStatus Current order status
 * @param toStatus Target order status from cargo tracking
 * @returns Boolean indicating if the cargo-based transition is allowed
 */
const isForwardCargoTransition = (fromStatus, toStatus) => {
    var _a, _b;
    // Same status is always allowed (idempotent)
    if (fromStatus === toStatus) {
        return true;
    }
    // Cannot exit from final statuses
    if (FINAL_STATUSES.includes(fromStatus)) {
        return false;
    }
    // Special case: Can return from Delivered
    if (toStatus === OrderStatus.Returned && fromStatus === OrderStatus.Delivered) {
        return true;
    }
    // Special case: Can fail from any active status
    if (toStatus === OrderStatus.Failed) {
        return true;
    }
    // Check if it's a forward transition
    const fromPriority = (_a = exports.ORDER_STATUS_PRIORITY[fromStatus]) !== null && _a !== void 0 ? _a : 0;
    const toPriority = (_b = exports.ORDER_STATUS_PRIORITY[toStatus]) !== null && _b !== void 0 ? _b : 0;
    // Allow forward transitions (to higher priority)
    return toPriority > fromPriority;
};
exports.isForwardCargoTransition = isForwardCargoTransition;
/**
 * Get list of intermediate statuses that were skipped in a status jump
 *
 * Example: Prepared (13) → Delivered (50)
 * Returns: [Packing, Packaged, ReadyToShip, Shipped, InTransit, OutForDelivery]
 *
 * @param fromStatus Starting status
 * @param toStatus Ending status
 * @returns Array of OrderStatus values that were skipped
 */
const getSkippedStatuses = (fromStatus, toStatus) => {
    var _a, _b;
    const fromPriority = (_a = exports.ORDER_STATUS_PRIORITY[fromStatus]) !== null && _a !== void 0 ? _a : 0;
    const toPriority = (_b = exports.ORDER_STATUS_PRIORITY[toStatus]) !== null && _b !== void 0 ? _b : 0;
    // No skip if not a forward jump
    if (toPriority <= fromPriority) {
        return [];
    }
    // Find all statuses between from and to
    const skipped = [];
    for (const [status, priority] of Object.entries(exports.ORDER_STATUS_PRIORITY)) {
        if (priority > fromPriority && priority < toPriority) {
            skipped.push(status);
        }
    }
    // Sort by priority
    return skipped.sort((a, b) => exports.ORDER_STATUS_PRIORITY[a] - exports.ORDER_STATUS_PRIORITY[b]);
};
exports.getSkippedStatuses = getSkippedStatuses;
//# sourceMappingURL=order-status.js.map