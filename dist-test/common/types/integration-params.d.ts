/**
 * Standart entegrasyon parametre tipleri
 *
 * Tüm marketplace ve ecommerce entegrasyonlarının
 * ortak kullandığı parametre ve sonuç tipleri.
 */
import { CommonProductExport } from "../interfaces/product-export.interface";
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
export interface OrderStatusItem {
    /** lineItemId (Hepsiburada) veya lineId (Trendyol) */
    id: string;
    quantity: number;
}
export interface UpdateOrderStatusParams {
    orderId: string;
    orderStatus?: string;
    platformStatus?: string;
    items?: OrderStatusItem[];
    notes?: string;
    purchaseNumber?: string;
    packageId?: string;
    trackingNumber?: string;
    trackingUrl?: string;
    cargoCompany?: string;
    shippedDate?: string;
    estimatedArrivalDate?: string;
    receivedDate?: string;
    receivedBy?: string;
}
export interface ProcessAfterOrderCreationParams {
    orderId: string;
    platformNumber: string;
    orderNumber?: string;
    currentFulfillmentStatus?: string;
    currentFulfillmentId?: string;
    currentPackageNumber?: string;
    platformData?: Record<string, unknown>;
}
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
export interface SyncCategoriesParams {
}
export interface SyncCategoryAttributesParams {
    categoryId?: number;
}
export interface SyncBrandsParams {
}
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
export interface GetReturnReasonsParams {
}
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
import { ProductPriceUpdateRequest, ProductStockUpdateRequest } from "../interfaces/product-export.interface";
export interface UpdatePricesParams {
    priceUpdates: ProductPriceUpdateRequest[];
}
export interface UpdateStocksParams {
    stockUpdates: ProductStockUpdateRequest[];
}
//# sourceMappingURL=integration-params.d.ts.map