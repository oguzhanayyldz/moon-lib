/**
 * Aras Kargo Durum Kodları
 * Kaynak: Aras API Dökümanı - Bölüm 3
 */
export enum ArasDeliveryStatus {
  AT_ORIGIN = 1,          // Çıkış Şubesinde
  IN_TRANSIT = 2,         // Yolda
  AT_DESTINATION = 3,     // Teslimat Şubesinde
  OUT_FOR_DELIVERY = 4,   // Teslimatta
  PARTIAL_DELIVERY = 5,   // Parçalı Teslimat
  DELIVERED = 6,          // Teslim Edildi
  REDIRECTED = 7          // Yönlendirildi
}

/**
 * Aras Tip Kodları
 */
export enum ArasShipmentType {
  NORMAL = 1,        // Normal
  REDIRECTED = 2,    // Yönlendirildi
  RETURNED = 3       // İade Edildi
}

/**
 * Aras Devir (Teslim Edilememe) Neden Kodları
 */
export enum ArasFailureReason {
  WRONG_ADDRESS = "AY",        // Adres Yanlış/Yetersiz
  NOTE_LEFT = "NT",            // Uğrama Notu Bırakıldı
  MOBILE_DELIVERY = "MD",      // Mobil Dağıtım
  PICKUP_AT_BRANCH = "SA",     // Şubeden Alacak
  RECIPIENT_UNKNOWN = "AA",    // Alıcı Tanınmıyor
  PAYMENT_REFUSED = "ÜR",      // Ücret Reddi
  CARGO_REFUSED = "KE"         // Kabul Etmiyor
}

/**
 * Aras Ödeme Tipleri
 */
export enum ArasPaymentType {
  SENDER_PAYS = "ÜG",   // Ücreti Göndericiden
  RECEIVER_PAYS = "ÜA"  // Ücreti Alıcıdan
}

/**
 * Aras QueryType Kodları (SOAP sorgu tipleri)
 */
export enum ArasQueryType {
  BY_INTEGRATION_CODE = 1,      // MÖK / Sipariş No ile sorgulama
  DATE_RANGE = 12,              // Tarih aralığı sorgu (standart)
  DATE_RANGE_DETAILED = 13,     // Tarih aralığı sorgu (tahsilatlı detaylı)
  BY_TRACKING_NUMBER = 14,      // Takip No ile sorgulama
  MOVEMENT_HISTORY = 15,        // Hareket detayları (Loop)
  BY_BARCODE = 24,              // Barkod ile sorgulama
  INCOMING_SHIPMENTS = 30       // Gelen kargolar (Return)
}
