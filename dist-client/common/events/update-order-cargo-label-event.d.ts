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
        orderNumber?: string;
        shipmentPackageId?: number;
        purchaseNumber?: string;
        printLink: string;
        labelFormat?: 'PDF' | 'PNG' | 'ZPL';
        trackingNumber?: string;
        shippingNumber?: string;
        barcode?: string;
        packageNumber?: string;
        timestamp?: Date;
    };
}
