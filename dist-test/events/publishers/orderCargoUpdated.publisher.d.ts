import { Publisher, Subjects, OrderCargoUpdatedEvent } from '../../common';
/**
 * OrderCargoUpdated Publisher
 *
 * OrderCargo bilgileri güncellendiğinde event yayınlar.
 * Shipment Service tarafından kullanılır.
 */
export declare class OrderCargoUpdatedPublisher extends Publisher<OrderCargoUpdatedEvent> {
    subject: Subjects.OrderCargoUpdated;
}
//# sourceMappingURL=orderCargoUpdated.publisher.d.ts.map