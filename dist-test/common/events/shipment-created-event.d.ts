import { Subjects } from "./subjects";
/**
 * ShipmentCreatedEvent - Kargo gönderimi oluşturulduğunda yayınlanır
 *
 * Bu event Shipment Service tarafından yayınlanır ve Orders Service tarafından dinlenir.
 *
 * Kullanım Senaryoları:
 * - Cargo integration'dan kargo numarası (shippingNumber) alındığında
 * - Kargo etiketi (printLink) oluşturulduğunda
 * - Takip numarası (trackingNumber) oluşturulduğunda
 *
 * Orders Service bu event'i dinleyerek:
 * 1. Order ID ile Order'ı bulur
 * 2. Order.orderCargo referansı ile OrderCargo'yu bulur
 * 3. OrderCargo'yu günceller (shippingNumber, trackingNumber, printLink, etc.)
 * 4. OrderCargoUpdated event yayınlar (diğer servislere bildirir)
 *
 * Bu pattern sayesinde:
 * - Shipment Service kendi Shipment verilerini yönetir (source of truth)
 * - OrderCargo güncellemeleri sadece Orders Service tarafından yapılır (source of truth)
 * - Event-driven, loosely coupled architecture
 */
export interface ShipmentCreatedEvent {
    subject: Subjects.ShipmentCreated;
    data: {
        list: ShipmentCreated[];
        userId: string;
    };
}
/**
 * ShipmentCreated - Yeni oluşturulan kargo gönderimi bilgileri
 */
export interface ShipmentCreated {
    id: string;
    uuid: string;
    version: number;
    user: string;
    order: string;
    cargoIntegration: string;
    cargoIntegrationId?: string;
    shippingNumber?: string;
    trackingNumber?: string;
    printLink?: string;
    trackingLink?: string;
    deliveryStatus?: string;
    sentDate?: Date;
    shippedDate?: Date;
    deliveredDate?: Date;
    status: string;
    timestamp: Date;
}
//# sourceMappingURL=shipment-created-event.d.ts.map