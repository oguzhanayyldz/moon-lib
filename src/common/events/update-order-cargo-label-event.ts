import { Subjects } from "./subjects";

/**
 * UpdateOrderCargoLabelEvent - Kargo etiketi bilgisi güncellemesi için event
 *
 * Kullanım senaryoları:
 * - Hepsiburada'da paket oluşturulduktan sonra etiket çekildiğinde
 * - Trendyol'da Picking durumuna geçildikten sonra etiket çekildiğinde
 * - Manuel etiket çekme işlemlerinde
 *
 * Bu event, Integration Service'ler tarafından Orders Service'e
 * kargo etiketi bilgisini bildirmek için kullanılır.
 *
 * Orders Service bu event'i dinleyerek OrderCargo.printLink alanını günceller.
 */
export interface UpdateOrderCargoLabelEvent {
    subject: Subjects.UpdateOrderCargoLabel;
    data: {
        userId: string;
        integrationId: string;

        // Sipariş tanımlayıcıları - platform'a göre biri kullanılır
        orderNumber?: string;           // Hepsiburada için
        shipmentPackageId?: number;     // Trendyol için
        purchaseNumber?: string;        // Alternatif tanımlayıcı

        // Etiket bilgileri
        printLink: string;              // Etiket URL veya base64 data
        labelFormat?: 'PDF' | 'PNG' | 'ZPL';

        // Opsiyonel ek bilgiler
        trackingNumber?: string;
        shippingNumber?: string;
        barcode?: string;
        packageNumber?: string;

        timestamp?: Date;
    };
}
