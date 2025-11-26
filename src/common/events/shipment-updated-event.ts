import { Subjects } from "./subjects";

/**
 * ShipmentUpdatedEvent - Kargo gönderimi güncellendiğinde yayınlanır
 *
 * Bu event Shipment Service tarafından yayınlanır ve Orders Service tarafından dinlenir.
 *
 * Kullanım Senaryoları:
 * - syncOrdersStatus job'u cargo durumlarını sorguladığında
 * - Kargo durumu (deliveryStatus) değiştiğinde
 * - Kargo tarihlerı (shippedDate, deliveredDate) güncellendiğinde
 * - Takip bilgileri güncellendiğinde
 *
 * Orders Service bu event'i dinleyerek:
 * 1. Order ID ile Order'ı bulur
 * 2. Order.orderCargo referansı ile OrderCargo'yu bulur
 * 3. OrderCargo'yu günceller (partial update)
 * 4. OrderCargoUpdated event yayınlar (diğer servislere bildirir)
 *
 * Bu pattern sayesinde:
 * - Shipment Service kendi Shipment verilerini yönetir (source of truth)
 * - OrderCargo güncellemeleri sadece Orders Service tarafından yapılır (source of truth)
 * - Event-driven, loosely coupled architecture
 */
export interface ShipmentUpdatedEvent {
    subject: Subjects.ShipmentUpdated;
    data: {
        list: ShipmentUpdated[];
        userId: string;
    };
}

/**
 * ShipmentUpdated - Güncellenen kargo gönderimi bilgileri (partial update)
 */
export interface ShipmentUpdated {
    id: string;          // Shipment MongoDB ID
    version: number;
    user: string;
    order: string;       // Order MongoDB ID (Orders Service bu ID ile OrderCargo'yu günceller)

    // Kargo integration bilgileri (değişmez ama reference için)
    cargoIntegration?: string;

    // Güncellenen kargo bilgileri (partial - sadece değişenler)
    shippingNumber?: string;
    trackingNumber?: string;
    printLink?: string;
    trackingLink?: string;

    // Güncellenen kargo durumu
    deliveryStatus?: string;

    // Güncellenen tarihler
    sentDate?: Date;
    shippedDate?: Date;
    deliveredDate?: Date;

    // Güncellenen shipment durumu
    status?: string;

    // Timestamp
    timestamp: Date;
}
