import { ResourceName, CurrencyCode } from '../';

/**
 * ERP platformları arası ortak fatura veri modeli
 * Bu model, farklı ERP platformlarına (Parasut, Logo, SAP, Netsis, etc.)
 * aktarılacak fatura verilerini standartlaştırır.
 */
export interface CommonInvoiceExport {
  // Temel fatura bilgileri
  id: string;                       // Moon sistemindeki Invoice ID
  uuid: string;                     // Invoice UUID
  externalId?: string;              // ERP platformundaki ID (varsa - update işlemi için)

  // Sipariş referansı
  order: {
    id: string;                     // Order MongoDB ID
    uuid: string;                   // Order UUID
    purchaseNumber: string;         // Moon sistemindeki sipariş numarası
    platformNumber: string;         // Platform sipariş numarası (Trendyol, Shopify, etc.)
    platform: ResourceName;         // Hangi platformdan geldi
    date: Date;                     // Sipariş tarihi
  };

  // Fatura türü bilgileri
  invoiceType: 'SALES' | 'RETURN' | 'PROFORMA';                // Fatura tipi
  invoiceCategory: 'E_ARCHIVE' | 'E_INVOICE' | 'EXPORT';      // Fatura kategorisi

  // Müşteri bilgileri
  customer: {
    // Temel bilgiler
    name: string;
    surname: string;
    email?: string;
    phone?: string;

    // Vergi bilgileri
    taxNumber?: string;             // Vergi numarası (kurumsal için)
    taxOffice?: string;             // Vergi dairesi
    identityNumber?: string;        // TC kimlik no (bireysel için)
    companyName?: string;           // Şirket adı (kurumsal için)

    // Adres bilgileri
    address: {
      country: string;              // Ülke
      city: string;                 // Şehir
      district?: string;            // İlçe
      addressLine1: string;         // Adres satır 1
      addressLine2?: string;        // Adres satır 2
      postalCode?: string;          // Posta kodu
    };
  };

  // Fatura kalemleri
  items: Array<{
    // Ürün referansları
    productId?: string;             // Moon Product ID
    combinationId?: string;         // Moon Combination ID
    externalId?: string;            // ERP'deki ürün ID (varsa)

    // Ürün bilgileri
    name: string;                   // Ürün adı
    sku: string;                    // SKU kodu
    barcode?: string;               // Barkod
    code?: string;                  // Ürün kodu

    // Miktar
    quantity: number;               // Satılan miktar

    // Fiyat bilgileri
    unitPrice: number;              // Birim fiyat (KDV hariç)
    unitPriceWithTax: number;       // Birim fiyat (KDV dahil)
    taxRate: number;                // KDV oranı (örn: 18)
    taxAmount: number;              // Toplam KDV tutarı

    // İndirim
    discountRate?: number;          // İndirim oranı
    discountAmount?: number;        // İndirim tutarı

    // Toplam
    totalAmount: number;            // Toplam tutar (KDV dahil)
    totalWithoutTax: number;        // Toplam tutar (KDV hariç)
  }>;

  // Tutar bilgileri
  amounts: {
    subtotal: number;               // KDV hariç toplam
    taxTotal: number;               // KDV toplamı
    discountTotal: number;          // İndirim toplamı
    shippingTotal: number;          // Kargo ücreti
    shippingTaxRate?: number;       // Kargo KDV oranı
    total: number;                  // Genel toplam (KDV dahil)
    currency: CurrencyCode;         // Para birimi
  };

  // Tarih bilgileri
  issueDate: Date;                  // Fatura tarihi
  dueDate?: Date;                   // Vade tarihi (opsiyonel)

  // Notlar ve açıklamalar
  description?: string;             // Fatura açıklaması
  notes?: string;                   // Sipariş notları

  // Platform spesifik ek alanlar
  metadata?: Record<string, any>;
}

/**
 * Fatura aktarım isteği için girdi modeli
 */
export interface InvoiceExportRequest {
  // Aktarılacak fatura ID'si
  invoiceId: string;

  // Hedef ERP platformu
  erpPlatform: string;              // Parasut, Logo, SAP, Netsis, etc.

  // İşlem türü (create, update)
  operation: 'create' | 'update';

  // Kullanıcı ID
  userId: string;

  // Platform spesifik ek parametreler
  platformParams?: Record<string, any>;
}

/**
 * Fatura aktarım sonucu için çıktı modeli
 */
export interface InvoiceExportResult {
  // İşlem başarılı mı?
  success: boolean;

  // ERP platformunda oluşan ID
  externalId?: string;

  // ERP platformunda oluşan invoice ID (bazı ERP'lerde farklı olabilir)
  erpInvoiceId?: string;

  // Resmileştirilmiş fatura numarası (e-Arşiv/e-Fatura)
  invoiceNumber?: string;

  // PDF ve XML linkleri
  pdfUrl?: string;
  xmlUrl?: string;
  printUrl?: string;

  // GİB bilgileri (Türkiye için)
  gibUuid?: string;
  gibEttn?: string;

  // Resmileştirme tarihi
  formalizedAt?: Date;

  // Hata mesajı (başarısız olduğunda)
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };

  // Platforma özgü yanıt verileri
  platformResponse?: Record<string, any>;
}

/**
 * Fatura iptal isteği modeli
 */
export interface InvoiceCancelRequest {
  // İptal edilecek fatura ID'si
  invoiceId: string;

  // ERP platform ID'si
  externalId: string;

  // ERP platformu
  erpPlatform: string;

  // Kullanıcı ID
  userId: string;

  // İptal nedeni
  reason?: string;

  // Platform spesifik ek parametreler
  platformParams?: Record<string, any>;
}

/**
 * Fatura iptal sonucu modeli
 */
export interface InvoiceCancelResult {
  // İşlem başarılı mı?
  success: boolean;

  // Hata mesajı (başarısız olduğunda)
  error?: string;

  // Platforma özgü yanıt verileri
  platformResponse?: Record<string, any>;
}
