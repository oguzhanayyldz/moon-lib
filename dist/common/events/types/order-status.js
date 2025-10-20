"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isInFulfillmentProcess = exports.isActiveOrderStatus = exports.getNextPossibleStatuses = exports.isValidStatusTransition = exports.ORDER_STATUS_TRANSITIONS = exports.OrderStatus = void 0;
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
