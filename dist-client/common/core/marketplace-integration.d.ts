import { BaseIntegration } from "./base-integration";
import { SyncProductsParams, SyncOrdersParams, GetShippingLabelParams, SendInvoiceParams, SendTrackingParams, IntegrationResult, ShippingLabelResult, ProcessAfterOrderCreationParams, CreateProductsParams, UpdateProductsParams, UpdateOrderStatusParams, SyncOrderStatusesParams, SyncSingleOrderStatusParams, UpdatePricesParams, UpdateStocksParams, SyncCategoriesParams, SyncCategoryAttributesParams, SyncBrandsParams, GetCategoriesParams, GetCategoryAttributesParams, GetOrderByIdParams, GetReturnReasonsParams, ApproveReturnParams, RejectReturnParams } from "../types/integration-params";
import { ProductPriceIntegrationUpdated } from "../interfaces/product-price-integration-updated.interface";
export declare abstract class MarketPlaceIntegration extends BaseIntegration {
    constructor();
    abstract syncProducts(params?: SyncProductsParams): Promise<void>;
    abstract syncOrders(params?: SyncOrdersParams): Promise<void>;
    abstract getShippingLabel(params: GetShippingLabelParams): Promise<ShippingLabelResult>;
    abstract sendInvoice(params: SendInvoiceParams): Promise<IntegrationResult>;
    abstract processAfterOrderCreation(params: ProcessAfterOrderCreationParams): Promise<IntegrationResult>;
    abstract createProducts(params: CreateProductsParams): Promise<string>;
    abstract updateProducts(params: UpdateProductsParams): Promise<void>;
    abstract syncCategories(params?: SyncCategoriesParams): Promise<void>;
    abstract syncCategoryAttributes(params: SyncCategoryAttributesParams): Promise<void>;
    abstract getCategories(params?: GetCategoriesParams): Promise<any[]>;
    abstract getCategoryAttributes(params: GetCategoryAttributesParams): Promise<any[]>;
    abstract getOrderById(params: GetOrderByIdParams): Promise<any>;
    abstract getReturnReasons(params?: GetReturnReasonsParams): Promise<any>;
    abstract approveReturn(params: ApproveReturnParams): Promise<void>;
    abstract rejectReturn(params: RejectReturnParams): Promise<void>;
    syncBrands(_params?: SyncBrandsParams): Promise<void>;
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
}
