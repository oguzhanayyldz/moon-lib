/**
 * Aras Kargo Durum Kodları
 * Kaynak: Aras API Dökümanı - Bölüm 3
 */
export declare enum ArasDeliveryStatus {
    AT_ORIGIN = 1,// Çıkış Şubesinde
    IN_TRANSIT = 2,// Yolda
    AT_DESTINATION = 3,// Teslimat Şubesinde
    OUT_FOR_DELIVERY = 4,// Teslimatta
    PARTIAL_DELIVERY = 5,// Parçalı Teslimat
    DELIVERED = 6,// Teslim Edildi
    REDIRECTED = 7
}
/**
 * Aras Tip Kodları
 */
export declare enum ArasShipmentType {
    NORMAL = 1,// Normal
    REDIRECTED = 2,// Yönlendirildi
    RETURNED = 3
}
/**
 * Aras Devir (Teslim Edilememe) Neden Kodları
 */
export declare enum ArasFailureReason {
    WRONG_ADDRESS = "AY",// Adres Yanlış/Yetersiz
    NOTE_LEFT = "NT",// Uğrama Notu Bırakıldı
    MOBILE_DELIVERY = "MD",// Mobil Dağıtım
    PICKUP_AT_BRANCH = "SA",// Şubeden Alacak
    RECIPIENT_UNKNOWN = "AA",// Alıcı Tanınmıyor
    PAYMENT_REFUSED = "\u00DCR",// Ücret Reddi
    CARGO_REFUSED = "KE"
}
/**
 * Aras Ödeme Tipleri
 */
export declare enum ArasPaymentType {
    SENDER_PAYS = "\u00DCG",// Ücreti Göndericiden
    RECEIVER_PAYS = "\u00DCA"
}
/**
 * Aras QueryType Kodları (SOAP sorgu tipleri)
 */
export declare enum ArasQueryType {
    BY_INTEGRATION_CODE = 1,// MÖK / Sipariş No ile sorgulama
    DATE_RANGE = 12,// Tarih aralığı sorgu (standart)
    DATE_RANGE_DETAILED = 13,// Tarih aralığı sorgu (tahsilatlı detaylı)
    BY_TRACKING_NUMBER = 14,// Takip No ile sorgulama
    MOVEMENT_HISTORY = 15,// Hareket detayları (Loop)
    BY_BARCODE = 24,// Barkod ile sorgulama
    INCOMING_SHIPMENTS = 30
}
//# sourceMappingURL=aras-status.enum.d.ts.map