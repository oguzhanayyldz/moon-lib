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
    id: string;          // Shipment MongoDB ID
    uuid: string;
    version: number;
    user: string;
    order: string;       // Order MongoDB ID (Orders Service bu ID ile OrderCargo'yu günceller)

    // Kargo integration bilgileri
    cargoIntegration: string; // 'aras', 'yurtici', 'mng', etc.
    cargoIntegrationId?: string;

    // Kargo bilgileri
    shippingNumber?: string;   // Kargo numarası
    trackingNumber?: string;   // Takip numarası
    printLink?: string;        // Etiket yazdırma linki
    trackingLink?: string;     // Müşteri takip linki

    // Kargo durumu (cargo integration'dan gelen)
    deliveryStatus?: string;   // 'in_transit', 'delivered', etc.

    // Tarihler
    sentDate?: Date;           // Kargo şirketine teslim tarihi
    shippedDate?: Date;        // Kargo çıkış tarihi
    deliveredDate?: Date;      // Teslim tarihi

    // Shipment durumu
    status: string;            // 'pending', 'created', 'failed', 'cancelled'

    // Platform tracking bilgileri (Shopify, Trendyol vb.)
    platformTrackingSent?: boolean;
    platformTrackingSentAt?: Date;
    platformTrackingError?: string;

    // Timestamp
    timestamp: Date;
}
