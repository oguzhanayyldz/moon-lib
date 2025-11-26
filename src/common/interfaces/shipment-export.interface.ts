/**
 * Platformlar arası ortak kargo gönderimi veri modeli
 * Bu model, farklı kargo entegrasyon platformlarına aktarılacak kargo verilerini standartlaştırır.
 *
 * CommonProductExport pattern'ini takip eder.
 */

/**
 * Kargo adresi modeli
 */
export interface ShipmentAddress {
    country: string;              // Ülke
    city: string;                 // Şehir
    district: string;             // İlçe
    neighborhood?: string;        // Mahalle
    addressLine1: string;         // Adres satırı 1
    addressLine2?: string;        // Adres satırı 2 (opsiyonel)
    postalCode?: string;          // Posta kodu

    // Koordinatlar (opsiyonel - bazı kargo firmaları destekler)
    latitude?: number;
    longitude?: number;
}

/**
 * Kargo gönderimi için ortak veri modeli
 */
export interface CommonShipmentExport {
    // ============================================================
    // TEMEL BİLGİLER
    // ============================================================

    id: string;                   // Moon sistemindeki Shipment ID
    externalId?: string;          // Kargo platformundaki ID (varsa)
    orderId: string;              // İlgili sipariş ID

    // ============================================================
    // GÖNDERİCİ BİLGİLERİ
    // ============================================================

    sender: {
        name: string;             // Gönderici adı
        phone: string;            // Gönderici telefon
        email?: string;           // Gönderici email (opsiyonel)
        address: ShipmentAddress; // Gönderici adresi
        taxNumber?: string;       // Vergi numarası (ticari gönderimler için)
        taxOffice?: string;       // Vergi dairesi
    };

    // ============================================================
    // ALICI BİLGİLERİ
    // ============================================================

    recipient: {
        name: string;             // Alıcı adı
        phone: string;            // Alıcı telefon
        email?: string;           // Alıcı email (opsiyonel)
        address: ShipmentAddress; // Alıcı adresi
        identityNumber?: string;  // TC Kimlik No (gümrük için gerekli olabilir)
        taxNumber?: string;       // Vergi numarası (kurumsal teslimatlar için)
    };

    // ============================================================
    // PAKET BİLGİLERİ
    // ============================================================

    package: {
        weight: number;           // Ağırlık
        weightUnit: 'kg' | 'g';   // Ağırlık birimi
        dimensions?: {            // Boyutlar (opsiyonel)
            length: number;       // Uzunluk
            width: number;        // Genişlik
            height: number;       // Yükseklik
            unit: 'cm' | 'm';     // Boyut birimi
        };
        desi?: number;           // Desi hesabı (bazı kargolar için)
        quantity: number;         // Paket/Koli adedi
        description?: string;     // İçerik açıklaması
        content?: string;         // Paket içeriği detayı
    };

    // ============================================================
    // ÖDEME BİLGİLERİ
    // ============================================================

    payment: {
        type: 'sender' | 'recipient';  // Gönderici öder / Alıcı öder
        amount?: number;                // Kapıda ödeme tutarı (varsa)
        currency?: string;              // Para birimi (TRY, USD, EUR, etc.)
    };

    // ============================================================
    // TESLİMAT TERCİHLERİ
    // ============================================================

    delivery?: {
        type?: 'standard' | 'express' | 'economy';  // Teslimat tipi
        preferredDate?: Date;                        // Tercih edilen teslimat tarihi
        preferredTimeSlot?: string;                  // Tercih edilen zaman dilimi
        instructions?: string;                       // Teslimat talimatları
        requireSignature?: boolean;                  // İmza gerekli mi?
    };

    // ============================================================
    // SİGORTA VE DEĞERLİ EŞYA
    // ============================================================

    insurance?: {
        required: boolean;        // Sigorta istiyor mu?
        amount?: number;          // Sigorta bedeli
        currency?: string;        // Para birimi
    };

    // ============================================================
    // SİPARİŞ DETAYLARI
    // ============================================================

    order?: {
        orderNumber?: string;     // Sipariş numarası
        platform?: string;        // Sipariş platformu (Shopify, Trendyol, etc.)
        platformOrderId?: string; // Platform sipariş ID
        totalAmount?: number;     // Sipariş toplam tutarı
        currency?: string;        // Para birimi
    };

    // ============================================================
    // ETİKET YAZDIRMA TERCİHİ
    // ============================================================

    autoPrintLabel?: boolean;     // Kargo oluşturulunca hemen etiket al

    // ============================================================
    // PLATFORM SPESİFİK EK ALANLAR
    // ============================================================

    metadata?: Record<string, any>;
}

/**
 * Kargo gönderimi oluşturma isteği modeli
 */
export interface ShipmentExportRequest {
    // Oluşturulacak shipment ID'si
    shipmentId: string;

    // Hedef kargo platformu
    platform: string;              // 'aras', 'mng', 'yurtici', 'ptt', etc.

    // İşlem türü
    operation: 'create' | 'cancel';

    // Platform spesifik ek parametreler
    platformParams?: Record<string, any>;
}

/**
 * Kargo gönderimi oluşturma sonucu modeli
 */
export interface ShipmentExportResult {
    // İşlem başarılı mı?
    success: boolean;

    // Kargo numarası (cargo company tracking number)
    shippingNumber?: string;

    // Takip numarası (customer tracking number)
    trackingNumber?: string;

    // Etiket yazdırma linki
    printLink?: string;

    // Müşteri takip linki
    trackingLink?: string;

    // Tahmini teslimat tarihi
    estimatedDeliveryDate?: Date;

    // Hata mesajı (başarısız olduğunda)
    error?: string;

    // Platforma özgü yanıt verileri
    platformResponse?: Record<string, any>;
}

/**
 * Kargo etiket yazdırma isteği modeli
 */
export interface ShipmentLabelRequest {
    // Kargo numarası
    shippingNumber: string;

    // OrderCargo ID (opsiyonel, tracking için)
    orderCargoId?: string;

    // Etiket formatı tercihi (opsiyonel)
    format?: 'pdf' | 'zpl' | 'epl';
}

/**
 * Kargo etiket yazdırma sonucu modeli
 */
export interface ShipmentLabelResult {
    // İşlem başarılı mı?
    success: boolean;

    // Etiket PDF linki
    printLink?: string;

    // Base64 encoded etiket data (direct print için)
    printData?: string;

    // Etiket formatı
    format?: 'pdf' | 'zpl' | 'epl';

    // Hata mesajı (başarısız olduğunda)
    error?: string;
}

/**
 * Kargo takip sorgulama isteği modeli
 */
export interface ShipmentTrackingRequest {
    // Kargo numarası
    shippingNumber: string;

    // Takip numarası (varsa)
    trackingNumber?: string;
}

/**
 * Kargo takip sorgulama sonucu modeli
 */
export interface ShipmentTrackingResult {
    // İşlem başarılı mı?
    success: boolean;

    // Kargo numarası
    shippingNumber: string;

    // Takip numarası
    trackingNumber?: string;

    // Kargo durumu (raw - kargo firmasından gelen)
    deliveryStatus?: string;

    // Normalize edilmiş durum
    normalizedStatus?: 'pending' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed_delivery' | 'returned' | 'cancelled';

    // Güncel lokasyon
    currentLocation?: string;

    // Son checkpoint
    lastCheckpoint?: string;

    // Tarihler
    sentDate?: Date;              // Kargo şirketine teslim
    shippedDate?: Date;           // Kargo çıkış
    deliveredDate?: Date;         // Teslim

    // Takip geçmişi
    history?: Array<{
        date: Date;
        status: string;
        description: string;
        location?: string;
    }>;

    // Hata mesajı (başarısız olduğunda)
    error?: string;

    // Platforma özgü yanıt verileri
    platformResponse?: Record<string, any>;
}

/**
 * Kargo iptal isteği modeli
 */
export interface ShipmentCancelRequest {
    // Kargo numarası
    shippingNumber: string;

    // İptal nedeni (opsiyonel)
    reason?: string;
}

/**
 * Kargo iptal sonucu modeli
 */
export interface ShipmentCancelResult {
    // İşlem başarılı mı?
    success: boolean;

    // Kargo numarası
    shippingNumber: string;

    // İptal edildi mi?
    cancelled: boolean;

    // İptal tarihi
    cancelledAt?: Date;

    // Mesaj/Açıklama
    message?: string;

    // Hata mesajı (başarısız olduğunda)
    error?: string;
}

/**
 * Toplu kargo takip güncellemesi için batch item
 */
export interface ShipmentTrackingBatchItem {
    // OrderCargo ID
    orderCargoId: string;

    // Kargo numarası
    shippingNumber: string;

    // Takip numarası (varsa)
    trackingNumber?: string;
}

/**
 * Toplu kargo takip güncellemesi sonucu
 */
export interface ShipmentTrackingBatchResult {
    // OrderCargo ID
    orderCargoId: string;

    // Kargo numarası
    shippingNumber: string;

    // İşlem başarılı mı?
    success: boolean;

    // Takip numarası
    trackingNumber?: string;

    // Kargo durumu
    deliveryStatus?: string;

    // Normalize edilmiş durum
    normalizedStatus?: string;

    // Tarihler
    sentDate?: Date;
    shippedDate?: Date;
    deliveredDate?: Date;

    // Güncel lokasyon
    currentLocation?: string;

    // Hata mesajı (başarısız olduğunda)
    error?: string;

    // Hata detayları
    errorDetails?: any;
}
