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
    order: string;
    version: number;
    shippingNumber?: string;
    trackingNumber?: string;
    printLink?: string;
    trackingLink?: string;
    sentDate?: Date;
    shippedDate?: Date;
    deliveredDate?: Date;
    deliveryStatus?: string;
    platformTrackingSynced?: boolean;
    platformTrackingSyncedAt?: Date;
    timestamp: Date;
}
