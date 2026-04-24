/**
 * HepsiJet Kargo Durum Kodları
 * Kaynak: HepsiJet Developer Docs (https://developers.hepsiburada.com/hepsiburada/reference/post_rest-deliverytransaction-getdeliverytracking)
 */

/**
 * HepsiJet Teslimat Durumları (delivery status)
 * `getDeliveryTracking` response'undaki `status` alanında doner
 */
export enum HepsiJetDeliveryStatus {
  CREATED = "CREATED",                       // Siparis olusturuldu
  COLLECTED = "COLLECTED",                   // Gonderi kurye tarafindan alindi
  IN_TRANSFER_HUB = "IN_TRANSFER_HUB",       // Aktarma merkezinde
  OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY",     // Teslimat icin kuryede
  DELIVERING = "DELIVERING",                 // Teslimat sureci basladi
  DELIVERED = "DELIVERED",                   // Teslim edildi
  NOT_DELIVERED = "NOT_DELIVERED",           // Teslim edilemedi
  RETURNED_TO_HUB = "RETURNED_TO_HUB",       // Subeye geri dondu
  RETURNED_TO_SENDER = "RETURNED_TO_SENDER", // Gondericiye iade edildi
  CANCELLED = "CANCELLED",                   // Iptal edildi
  UNKNOWN = "UNKNOWN"                        // Bilinmiyor
}

/**
 * HepsiJet Service Type Kodları
 * `sendDeliveryOrder` / `sendDeliveryOrderEnhanced` endpoint'lerinde kullanilir
 */
export enum HepsiJetServiceType {
  STANDARD = "STANDARD",   // Standart gonderim (desi <= 40)
  TMH = "TMH",             // XL / Buyuk paket (desi >= 41)
  POD = "POD",             // Kapida tahsilat (Payment on Delivery)
  APPOINTMENT = "APPOINTMENT" // Randevulu teslimat
}

/**
 * HepsiJet Label Format Kodları
 * `printLabel` islemlerinde kullanilan cikti formati
 */
export enum HepsiJetLabelFormat {
  ZPL = "ZPL",   // Zebra yazici formati
  PDF = "PDF"    // PDF etiket
}

/**
 * HepsiJet teslim edilememe nedenleri
 * `not_delivered` durumundaki shipment'lar icin dogrulama
 */
export enum HepsiJetFailureReason {
  ADDRESS_NOT_FOUND = "ADDRESS_NOT_FOUND",       // Adres bulunamadi
  RECIPIENT_NOT_AVAILABLE = "RECIPIENT_NOT_AVAILABLE", // Alici musait degil
  REFUSED = "REFUSED",                            // Kabul etmedi
  DAMAGED = "DAMAGED",                            // Hasarli
  INCORRECT_PAYMENT = "INCORRECT_PAYMENT",        // Yanlis odeme tutari
  OTHER = "OTHER"                                 // Diger
}

/**
 * HepsiJet durumlarini Moon Project standart `deliveryStatus` degerlerine cevirir.
 *
 * Moon standart degerleri:
 * - pending, in_transit, out_for_delivery, delivered, cancelled,
 *   returned, not_delivered, unknown
 */
export function mapHepsiJetStatusToDeliveryStatus(status: string | undefined | null): string {
  if (!status) return 'unknown';

  const normalized = status.toString().toUpperCase();

  const statusMap: Record<string, string> = {
    [HepsiJetDeliveryStatus.CREATED]: 'pending',
    [HepsiJetDeliveryStatus.COLLECTED]: 'in_transit',
    [HepsiJetDeliveryStatus.IN_TRANSFER_HUB]: 'in_transit',
    [HepsiJetDeliveryStatus.OUT_FOR_DELIVERY]: 'out_for_delivery',
    [HepsiJetDeliveryStatus.DELIVERING]: 'out_for_delivery',
    [HepsiJetDeliveryStatus.DELIVERED]: 'delivered',
    [HepsiJetDeliveryStatus.NOT_DELIVERED]: 'not_delivered',
    [HepsiJetDeliveryStatus.RETURNED_TO_HUB]: 'in_transit',
    [HepsiJetDeliveryStatus.RETURNED_TO_SENDER]: 'returned',
    [HepsiJetDeliveryStatus.CANCELLED]: 'cancelled',
    [HepsiJetDeliveryStatus.UNKNOWN]: 'unknown'
  };

  return statusMap[normalized] || 'unknown';
}
