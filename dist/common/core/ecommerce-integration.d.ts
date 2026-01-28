import { BaseIntegration } from "./base-integration";
import { SyncProductsParams, SyncOrdersParams, GetShippingLabelParams, SendInvoiceParams, SendTrackingParams, IntegrationResult, ShippingLabelResult, ProcessAfterOrderCreationParams, CreateProductsParams, UpdateProductsParams, UpdateOrderStatusParams, SyncOrderStatusesParams, SyncSingleOrderStatusParams, UpdatePricesParams, UpdateStocksParams } from "../types/integration-params";
import { ProductPriceIntegrationUpdated } from "../interfaces/product-price-integration-updated.interface";
export declare abstract class EcommerceIntegration extends BaseIntegration {
    constructor();
    abstract syncProducts(params?: SyncProductsParams): Promise<void>;
    abstract syncOrders(params?: SyncOrdersParams): Promise<void>;
    abstract getShippingLabel(params: GetShippingLabelParams): Promise<ShippingLabelResult>;
    abstract sendInvoice(params: SendInvoiceParams): Promise<IntegrationResult>;
    abstract processAfterOrderCreation(params: ProcessAfterOrderCreationParams): Promise<IntegrationResult>;
    abstract createProducts(params: CreateProductsParams): Promise<string>;
    abstract updateProducts(params: UpdateProductsParams): Promise<void>;
    sendTracking(_params: SendTrackingParams): Promise<IntegrationResult>;
    abstract fetchPrices(): Promise<ProductPriceIntegrationUpdated[] | null>;
    abstract fetchStocks(): Promise<void>;
    abstract fetchImages(): Promise<void>;
    abstract matchProducts(): Promise<void>;
    abstract updatePrices(params: UpdatePricesParams): Promise<{
        success: boolean;
        results: any[];
    }>;
    abstract updateStocks(params: UpdateStocksParams): Promise<{
        success: boolean;
        results: any[];
    }>;
    abstract updateOrderStatus(params: UpdateOrderStatusParams): Promise<IntegrationResult>;
    abstract syncOrderStatuses(params: SyncOrderStatusesParams): Promise<void>;
    abstract syncSingleOrderStatus(params: SyncSingleOrderStatusParams): Promise<void>;
    fetchLocations(): Promise<IntegrationResult>;
}
