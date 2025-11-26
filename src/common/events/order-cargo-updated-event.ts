import { Subjects } from "./subjects";

/**
 * OrderCargoUpdatedEvent - OrderCargo bilgileri güncellendiğinde yayınlanır
 *
 * Kullanım senaryoları:
 * - Kargo numarası (shippingNumber) oluşturuldu
 * - Kargo etiketi (printLink) oluşturuldu
 * - Takip numarası (trackingNumber) güncellendi
 * - Kargo durumu (sentDate, shippedDate, deliveredDate) güncellendi
 * - Platform'a takip numarası gönderildi (platformTrackingSynced)
 *
 * Bu event, Shipment Service tarafından OrderCargo güncellemelerini
 * Orders Service'e bildirmek için kullanılır.
 *
 * Orders Service kendi OrderCargoUpdated listener'ında:
 * 1. Order ID ile Order'ı bulur
 * 2. Order'ın OrderCargo'sunu bulur (her Order'ın tek bir OrderCargo'su vardır)
 * 3. updates object'indeki alanları günceller
 *
 * Bu pattern sayesinde Shipment Service, Orders Service'e HTTP çağrısı yapmadan
 * event-driven şekilde OrderCargo güncellemelerini bildirir.
 */
export interface OrderCargoUpdatedEvent {
    subject: Subjects.OrderCargoUpdated;
    data: {
        list: OrderCargoUpdated[];
        userId: string;
    };
}

/**
 * OrderCargoUpdated - Güncellenecek OrderCargo bilgileri
 */
export interface OrderCargoUpdated {
    order: string; // Order MongoDB ID (Orders Service bu ID ile Order'ı bulur, Order'ın OrderCargo'sunu günceller)
    version: number; // Version for optimistic locking

    // Kargo bilgileri - güncellenen kritik alanlar (partial update)
    shippingNumber?: string; // Kargo şirketine teslim için numara
    trackingNumber?: string; // Müşteri takip numarası
    printLink?: string; // Kargo etiketi PDF linki
    trackingLink?: string; // Kargo takip linki

    // Tarihler
    sentDate?: Date; // Kargo şirketine teslim tarihi
    shippedDate?: Date; // Kargo çıkış tarihi
    deliveredDate?: Date; // Teslim tarihi

    // Delivery status (string for flexibility across cargo providers)
    deliveryStatus?: string;

    // Platform sync bilgisi
    platformTrackingSynced?: boolean; // Takip numarası platform'a gönderildi mi?
    platformTrackingSyncedAt?: Date; // Platform'a gönderilme tarihi

    // Timestamp
    timestamp: Date;
}
