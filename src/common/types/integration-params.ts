/**
 * Standart entegrasyon parametre tipleri
 *
 * Tüm marketplace ve ecommerce entegrasyonlarının
 * ortak kullandığı parametre ve sonuç tipleri.
 */

import { CommonProductExport } from "../interfaces/product-export.interface";
import { OrderStatus } from "../events/types/order-status";

// === Kargo & Fatura Parametre Tipleri ===

export interface SendTrackingParams {
    /** Platform paket/fulfillment ID */
    packageId: string;
    /** Kargo takip numarası */
    trackingNumber: string;
    /** Takip linki */
    trackingUrl?: string;
    /** Kargo firması adı */
    cargoCompany?: string;
    /** Kargoya verilme tarihi (ISO 8601) */
    shippedDate?: string;
}

export interface GetShippingLabelParams {
    /** Kargo takip numarası */
    trackingNumber: string;
    /** Etiket formatı */
    format?: 'ZPL' | 'PDF' | 'PNG';
}

export interface SendInvoiceParams {
    /** Platform paket/fulfillment ID */
    packageId: string;
    /** Fatura linki */
    invoiceLink: string;
    /** Fatura numarası */
    invoiceNumber?: string;
}

// === Ürün Senkronizasyon Parametreleri ===

export interface SyncProductsParams {
    page?: number;
    limit?: number;
    cursor?: string;
    query?: string;
    filters?: Record<string, unknown>;
}

export interface CreateProductParams {
    productData: CommonProductExport;
}

export interface UpdateProductParams {
    productId?: string;
    productData: CommonProductExport;
}

export interface CreateProductsParams {
    productDataArray: CommonProductExport[];
    mappingIds?: string[];
}

export interface UpdateProductsParams {
    productDataArray: CommonProductExport[];
    mappingIds?: string[];
}

// === Sipariş Parametreleri ===

export interface SyncOrdersParams {
    page?: number;
    limit?: number;
    cursor?: string;
    query?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
}

export interface CancelOrderParams {
    orderId: string;
    reason?: string;
}

// === Sipariş Statü Güncelleme ===

export interface OrderStatusItem {
    /** lineItemId (Hepsiburada) veya lineId (Trendyol) */
    id: string;
    quantity: number;
}

export interface UpdateOrderStatusParams {
    orderId: string;
    // Statü bilgisi
    orderStatus?: OrderStatus;
    platformStatus?: string;
    // Ortak sipariş bilgileri
    items?: OrderStatusItem[];
    notes?: string;
    purchaseNumber?: string;
    // Kargo/Teslimat bilgileri
    packageId?: string;
    trackingNumber?: string;
    trackingUrl?: string;
    cargoCompany?: string;
    shippedDate?: string;
    estimatedArrivalDate?: string;
    receivedDate?: string;
    receivedBy?: string;
}

// === Sipariş Oluşturma Sonrası İşlem Parametreleri ===

export interface ProcessAfterOrderCreationParams {
    orderId: string;
    platformNumber: string;
    orderNumber?: string;
    // İdempotency kontrol alanları
    currentFulfillmentStatus?: string;
    currentFulfillmentId?: string;
    currentPackageNumber?: string;
    // Platform-specific data (generic)
    platformData?: Record<string, unknown>;
}

// === Sonuç Tipleri ===

export interface IntegrationResult {
    success: boolean;
    message?: string;
    data?: unknown;
}

export interface ShippingLabelResult {
    success: boolean;
    labelData?: string;
    format?: string;
}

// === Marketplace-Only Parametre Tipleri ===

export interface SyncCategoriesParams {}

export interface SyncCategoryAttributesParams {
    categoryId?: number;
}

export interface SyncBrandsParams {}

export interface GetCategoriesParams {
    page?: number;
    size?: number;
}

export interface GetCategoryAttributesParams {
    categoryId: number;
}

export interface GetOrderByIdParams {
    orderId: string;
}

export interface SyncOrderStatusesParams {
    orderIds?: string[];
    userId: string;
    integrationName: string;
}

export interface SyncSingleOrderStatusParams {
    orderId: string;
    userId: string;
    integrationName: string;
}

export interface GetReturnReasonsParams {}

export interface ApproveReturnParams {
    claimId: string;
    claimLineItemIds: string[];
    finalizedWith?: 'Refund' | 'Change';
    invoiceLink?: string;
    acceptionReason?: string;
}

export interface RejectReturnParams {
    claimId: string;
    claimIssueReasonId: string;
    claimItemIds: string[];
    description: string;
    fileBase64?: string;
    filename?: string;
    reportsBase64?: string[];
}

// === Bulk Update Parametre Tipleri ===

import { ProductPriceUpdateRequest, ProductStockUpdateRequest } from "../interfaces/product-export.interface";

export interface UpdatePricesParams {
    priceUpdates: ProductPriceUpdateRequest[];
}

export interface UpdateStocksParams {
    stockUpdates: ProductStockUpdateRequest[];
}
