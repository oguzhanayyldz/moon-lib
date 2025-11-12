import { Subjects } from "./subjects";

/**
 * OrderProductStockUpdated Event
 * Bu event OrderProduct'ların stok rezervasyon durumları güncellendiğinde yayınlanır
 * Özellikle Inventory servisi tarafından kısmi rezervasyon durumlarında kullanılır
 */
export interface OrderProductStockUpdatedEvent {
    subject: Subjects.OrderProductUpdated;
    data: OrderProductStockUpdatedEventData;
}

export interface OrderProductStockUpdatedEventData {
    id: string; // OrderProduct ID
    uuid: string;
    user: string;
    order: string; // Order ID
    version: number;

    // Stok rezervasyon bilgileri
    stockReserved: number; // Rezerve edilen stok miktarı
    stockShortage: boolean; // Stok açığı var mı?
    stockShortageAmount: number; // Eksik kalan miktar
    stockShortageResolvedAt?: Date; // Stok açığı ne zaman çözüldü

    // Ürün bilgileri (referans için)
    product?: string; // Product ID
    combination?: string; // Combination ID
    quantity: number; // Toplam sipariş miktarı
    sku: string;
    barcode: string;
    name: string;
}
