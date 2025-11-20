import { Subjects } from "./subjects";
import { InvoiceStatus, InvoiceType, InvoiceCategory } from "./types/invoice-status";
import { CurrencyCode } from "../types/currency-code";
import { ResourceName } from "../types/resourceName";

export interface InvoiceCreatedEvent {
    subject: Subjects.InvoiceCreated;
    data: {
        list: InvoiceCreated[];
        userId: string;
    };
}

export interface InvoiceCreated {
    id: string; // Invoice MongoDB ID
    uuid: string;
    user: string;
    version: number;

    // Order referansı (complete - Order event'inden gelen tüm bilgiler)
    order: {
        id: string;
        uuid: string;
        version: number;
        purchaseNumber: string; // Bizim sistemdeki sipariş numarası
        platformNumber: string; // Platform'dan gelen sipariş numarası (Trendyol, Shopify, vs.)
        platform: ResourceName; // Hangi platformdan geldi
        docSerial?: string;
        date: Date; // Sipariş tarihi
        currency: CurrencyCode;
        uniqueCode?: string | null;
        fields?: Record<string, any>; // Order'a ait custom alanlar
    };

    // Fatura bilgileri
    invoiceNumber?: string; // Resmileştirilmiş fatura numarası (e-Arşiv/e-Fatura) - başlangıçta null
    status: InvoiceStatus; // DRAFT, PROCESSING, FORMALIZED, FAILED, CANCELLED
    type: InvoiceType; // SALES, RETURN, PROFORMA
    category: InvoiceCategory; // E_ARCHIVE, E_INVOICE, EXPORT

    // ERP bilgileri (başlangıçta undefined, resmileştirme sonrası dolar)
    erpPlatform?: string; // Parasut, Logo, SAP, Netsis, etc.
    erpId?: string; // ERP'deki fatura ID'si
    erpInvoiceId?: string; // ERP'deki invoice_id (bazı ERP'lerde farklı olabilir)

    // Müşteri bilgileri (Order'dan gelen billing address + customer bilgileri)
    customer: {
        // Customer bilgileri
        customerId?: string;
        customerUuid?: string;
        code?: string; // Müşteri kodu

        // Kişisel bilgiler
        name: string;
        surname: string;
        email?: string;
        phone?: string;

        // Vergi bilgileri
        taxNumber?: string;
        taxOffice?: string;
        identityNumber?: string;
        companyName?: string;

        // Adres bilgileri (billingAddress'ten)
        address: {
            country: string;
            city: string;
            district?: string;
            addressLine1: string;
            addressLine2?: string;
            postalCode?: string;
        };

        fields?: Record<string, any>;
    };

    // Fatura kalemleri (OrderProducts'tan dönüştürülmüş)
    items: InvoiceItem[];

    // Tutarlar (Order'dan gelen tutarlar)
    amounts: {
        subtotal: number; // totalWithOutTax - KDV hariç toplam
        taxTotal: number; // taxTotal - KDV toplamı
        discountTotal: number; // discountTotal - İndirim toplamı
        shippingTotal: number; // shippingTotal - Kargo ücreti
        shippingTaxRate?: number; // shippingTaxRate - Kargo KDV oranı
        total: number; // total - Genel toplam (KDV dahil)
        currency: CurrencyCode;
    };

    // Tarihler
    issueDate: Date; // Fatura tarihi (genelde order.date ile aynı)
    dueDate?: Date; // Vade tarihi (opsiyonel)
    createdAt: Date;
    updatedAt: Date;

    // Notlar ve açıklamalar
    description?: string;
    notes?: string; // Order.note

    // Ek alanlar
    fields?: Record<string, any>;
}

export interface InvoiceItem {
    id: string; // OrderProduct ID
    uuid: string;
    version: number;

    // Ürün referansları
    productId?: string; // Product schema ID
    combinationId?: string; // Combination schema ID
    packageProductId?: string; // Package product ID

    // Ürün bilgileri
    name: string;
    sku: string;
    barcode: string;
    code?: string;

    // Miktar
    quantity: number;
    exQuantity?: number; // Exchange quantity (iade için)

    // Fiyat bilgileri (OrderProduct'tan gelen)
    unitPrice: number; // priceWithoutTax - Birim fiyat (KDV hariç)
    unitPriceWithTax: number; // price - Birim fiyat (KDV dahil)
    taxRate: number; // tax - KDV oranı (örn: 18)
    taxPrice: number; // taxPrice - Birim KDV tutarı
    taxAmount: number; // taxTotal - Toplam KDV tutarı

    // İndirim
    discountRate?: number; // discount - İndirim oranı
    discountAmount?: number; // discountTotal - İndirim tutarı

    // Komisyon (marketplace siparişleri için)
    commissionPrice?: number; // commissionPrice - Birim komisyon
    commissionAmount?: number; // commissionTotal - Toplam komisyon

    // Toplam
    totalAmount: number; // priceTotal - Toplam tutar (KDV dahil)
    totalWithoutTax: number; // priceTotal - taxTotal

    // ERP bilgileri (Product/Combination'dan gelen)
    erpProductId?: string; // Product.erpId
    erpPlatform?: string; // Product.erpPlatform

    // Ek alanlar
    fields?: Record<string, any>;
}
