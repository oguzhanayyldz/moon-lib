import { Publisher, Subjects, ShipmentUpdatedEvent } from '../../common';

/**
 * ShipmentUpdated Publisher
 *
 * Kargo gönderimi güncellendiğinde event yayınlar.
 * Shipment Service tarafından kullanılır.
 *
 * Kullanım senaryoları:
 * - syncOrdersStatus job'u cargo durumlarını güncellediğinde
 * - Kargo bilgileri manuel olarak güncellendiğinde
 *
 * Orders Service bu event'i dinleyerek OrderCargo'yu günceller.
 */
export class ShipmentUpdatedPublisher extends Publisher<ShipmentUpdatedEvent> {
    subject: Subjects.ShipmentUpdated = Subjects.ShipmentUpdated;
}
