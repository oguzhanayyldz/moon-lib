/**
 * HepsiJet Kargo Enum'lari
 * Kaynak: HepsiJet Developer Docs (docs/integrations/hepsijet/)
 *
 * Bu dosyadaki enum degerleri GERCEK API response'larinda donen degerlerdir.
 * Doc: 12-getDeliveryTracking-rest.md, 03-sendDeliveryOrderEnhanced.md
 */
/**
 * HepsiJet Teslimat Durumlari (deliveryStatus)
 * Kaynak: docs/integrations/hepsijet/12-getDeliveryTracking-rest.md
 */
export declare enum HepsiJetDeliveryStatus {
    COLLECTED = "COLLECTED",// Gonderi kurye tarafindan alindi
    TRANSFERRING_COLLECT = "TRANSFERRING_COLLECT",// Transfer halinde (hub'a dogru)
    READY = "READY",// Dagitima hazir
    WAITING_FOR_DISPATCH = "WAITING_FOR_DISPATCH",// Dagitim bekliyor
    DELIVERING = "DELIVERING",// Dagitimda (kurye yolda)
    DELIVERED = "DELIVERED",// Teslim edildi
    UNDELIVERED = "UNDELIVERED",// Teslim edilemedi
    RETURNED = "RETURNED",// Iade edildi
    CANCELLED = "CANCELLED"
}
/**
 * HepsiJet Operasyon Durumlari (operationStatus)
 * Kaynak: docs/integrations/hepsijet/12-getDeliveryTracking-rest.md
 */
export declare enum HepsiJetOperationStatus {
    IN_DELIVERY_TRANSIT = "IN_DELIVERY_TRANSIT",// Teslimat transfer arasinda
    IN_RING_TRANSIT = "IN_RING_TRANSIT",// Ring transfer arasinda
    IN_RING_VEHICLE = "IN_RING_VEHICLE",// Ring aracinda
    IN_XDOCK = "IN_XDOCK",// Cross-dock'ta
    IN_RECIPIENT = "IN_RECIPIENT",// Aliciya ulasti
    IN_RETURN_TRANSIT = "IN_RETURN_TRANSIT"
}
/**
 * HepsiJet Transaction Type (gonderinin hareket tipi)
 * Kaynak: docs/integrations/hepsijet/12-getDeliveryTracking-rest.md
 */
export declare enum HepsiJetTransactionType {
    TAKE_CUSTODY = "TAKE_CUSTODY",// Gonderinin alinmasi
    APPROVE_RING_DEPART = "APPROVE_RING_DEPART",// Ring cikisi onayi
    APPROVE_RING_ARRIVE = "APPROVE_RING_ARRIVE",// Ring varis onayi
    UNLOAD_RING_VEHICLE = "UNLOAD_RING_VEHICLE",// Ring arac bosaltmasi
    APPROVE_COURIER_DEPART = "APPROVE_COURIER_DEPART",// Kurye cikis onayi
    DELIVERY_ATTEMPT = "DELIVERY_ATTEMPT"
}
/**
 * HepsiJet Teslimat Tipi (deliveryType)
 * Kaynak: docs/integrations/hepsijet/03-sendDeliveryOrderEnhanced.md
 */
export declare enum HepsiJetDeliveryType {
    RETAIL = "RETAIL",// Perakende (B2C)
    MARKET_PLACE = "MARKET_PLACE",// Marketplace siparis
    RETURNED = "RETURNED"
}
/**
 * HepsiJet Product Code (teslimat urun kodu)
 * Kaynak: docs/integrations/hepsijet/03-sendDeliveryOrderEnhanced.md
 *
 * NOT: Onceki versiyondaki "serviceType" (STANDARD/TMH/POD/APPOINTMENT) dokumantasyona uymuyordu.
 * Gercek API payload'inda delivery.product.productCode kullanilir.
 */
export declare enum HepsiJetProductCode {
    HX_STD = "HX_STD",// Standart Teslimat (0-40 desi)
    HX_SD = "HX_SD",// Ayni Gun Teslimat (slot saati ile)
    HX_ND = "HX_ND"
}
/**
 * HepsiJet Delivery Slot (teslimat saat dilimi)
 * Kaynak: docs/integrations/hepsijet/03-sendDeliveryOrderEnhanced.md
 */
export declare enum HepsiJetDeliverySlot {
    STANDARD = "0",// Standart (belirtilen gun icinde)
    SLOT_1 = "1",// 09:00 - 13:00 arasi
    SLOT_2 = "2",// 13:00 - 18:00 arasi
    SLOT_3 = "3"
}
/**
 * HepsiJet Label Format
 * ZPL: GET /delivery/generateZplBarcode/{barcode}/{totalParcel}
 * PDF: POST /delivery/barcodes/label
 */
export declare enum HepsiJetLabelFormat {
    ZPL = "ZPL",
    PDF = "PDF"
}
/**
 * HepsiJet teslim edilememe nedenleri (nonDeliveryReason)
 * Kaynak: docs/integrations/hepsijet/12-getDeliveryTracking-rest.md
 */
export declare enum HepsiJetFailureReason {
    RECIPIENT_NOT_FOUND = "RECIPIENT_NOT_FOUND",// Alici bulunamadi
    ADDRESS_NOT_FOUND = "ADDRESS_NOT_FOUND",// Adres bulunamadi
    RECIPIENT_NOT_AVAILABLE = "RECIPIENT_NOT_AVAILABLE",// Alici musait degil
    REFUSED = "REFUSED",// Kabul etmedi
    DAMAGED = "DAMAGED",// Hasarli
    INCORRECT_PAYMENT = "INCORRECT_PAYMENT",// Yanlis odeme tutari
    OTHER = "OTHER"
}
/**
 * HepsiJet Sabitleri (doc'ta her request'te SABIT degerler olarak beklenen)
 * Kaynak: docs/integrations/hepsijet/03-sendDeliveryOrderEnhanced.md (company + senderAddress sabit)
 *
 * Bu degerler HepsiJet tarafinda satici firma icin tanimli oldugu icin sabittir.
 * Moon tarafinda credential olarak alinmaz.
 */
export declare const HEPSIJET_COMPANY_DEFAULTS: {
    readonly name: "Hepsijet_Firmasi";
    readonly abbreviationCode: "Hpsjet_Frmsi";
};
/**
 * HepsiJet durumlarini Moon Project standart `deliveryStatus` degerlerine cevirir.
 *
 * Moon standart degerleri:
 * - pending, in_transit, out_for_delivery, delivered, cancelled,
 *   returned, not_delivered, unknown
 */
export declare function mapHepsiJetStatusToDeliveryStatus(status: string | undefined | null): string;
