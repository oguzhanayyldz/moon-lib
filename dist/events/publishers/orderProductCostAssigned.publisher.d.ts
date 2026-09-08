import { Publisher, Subjects, OrderProductCostAssignedEvent } from '../../common';
/**
 * Siparis kalemi maliyet atama publisher'i (issue #683)
 * ProductCostUpdatedPublisher ile ayni retry davranisi.
 */
export declare class OrderProductCostAssignedPublisher extends Publisher<OrderProductCostAssignedEvent> {
    subject: Subjects.OrderProductCostAssigned;
    publish(data: OrderProductCostAssignedEvent['data']): Promise<void>;
}
