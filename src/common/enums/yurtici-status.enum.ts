/**
 * Yurtiçi Kargo Durum Kodları
 * Kaynak: Yurtiçi Kargo API Dökümanı - Bölüm 4
 */

/**
 * Yurtiçi Kargo Operasyon Statüleri (operationStatus)
 * Kargonun genel durumunu belirtir
 */
export enum YurticiOperationStatus {
  NOP = 0,    // Kargo İşlem Görmemiş
  IND = 1,    // Kargo Teslimattadır (Şubeden çıktı/Dağıtımda)
  ISR = 2,    // Kargo işlem görmüş, faturası henüz düzenlenmemiştir
  CNL = 3,    // Kargo Çıkışı Engellendi (İptal)
  DLV = 5     // Kargo Teslim edilmiştir
}

/**
 * Yurtiçi Kargo İade Durum Kodları (rejectStatus)
 * Kargo iade sürecindeyse dönen kodlar
 */
export enum YurticiRejectStatus {
  REQUESTED = 0,        // İade isteği yapıldı
  ORIGIN_APPROVED = 1,  // Çıkış Şubesi Onayladı
  REGION_APPROVED = 2,  // İade Bölge Onayladı
  COMPLETED = 9,        // İade Yapıldı
  CLOSED = 10          // İade Sonlandırıldı
}

/**
 * Yurtiçi Kargo Geri Dönüş Durumu (returnStatus)
 * Kargo teslim edilemediyse veya geri dönüşlü evrak varsa
 */
export enum YurticiReturnStatus {
  NOT_DELIVERED_NO_INVOICE = 0,  // Teslim Edilmedi ve Geri Dönüş Faturası Kesilmedi
  DELIVERED_NO_INVOICE = 1,      // Teslim Edildi ve Geri Dönüş Faturası Kesilmedi
  DELIVERED_INVOICED = 2,        // Teslim Edildi ve Geri Dönüş Faturası Kesildi
  RETURNED_TO_SENDER = 3         // Gönderici Müşteriye İade Edildi
}

/**
 * Yurtiçi Kargo Hata Kodları (errCode)
 * Sık karşılaşılan hata kodları
 */
export enum YurticiErrorCode {
  SUCCESS = 0,                         // Başarılı
  UNEXPECTED_ERROR = 936,              // Beklenmeyen Hata (Sistem hatası)
  DUPLICATE_CARGO_KEY = 60020,         // Kargo anahtarı sistemde zaten mevcut (Mükerrer kayıt)
  CARGO_KEY_NOT_FOUND = 80859,         // Kargo Anahtarı bulunamadı
  RECEIVER_ADDRESS_NOT_FOUND = 60019   // Alıcı adresi bulunamadı
}

/**
 * Yurtiçi Query KeyType
 * queryShipment metodunda kullanılan sorgulama tipi
 */
export enum YurticiQueryKeyType {
  CARGO_KEY = 0,        // cargoKey ile sorgulama
  TRACKING_NUMBER = 1   // Tracking number ile sorgulama (varsa)
}

/**
 * Yurtiçi COD (Kapıda Ödeme) Payment Type
 * Tahsilatlı gönderi ödeme tipi
 */
export enum YurticiCollectionType {
  CASH = "0",        // Nakit
  CREDIT_CARD = "1"  // Kredi Kartı
}
