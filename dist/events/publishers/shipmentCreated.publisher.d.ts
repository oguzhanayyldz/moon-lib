import { Publisher, Subjects, ShipmentCreatedEvent } from '../../common';
/**
 * ShipmentCreated Publisher
 *
 * Kargo gönderimi oluşturulduğunda event yayınlar.
 * Shipment Service tarafından kullanılır.
 *
 * Orders Service bu event'i dinleyerek OrderCargo'yu günceller.
 */
export declare class ShipmentCreatedPublisher extends Publisher<ShipmentCreatedEvent> {
    subject: Subjects.ShipmentCreated;
}
