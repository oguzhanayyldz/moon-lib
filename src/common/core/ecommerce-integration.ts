import { IntegrationType } from "../types/integration-type";
import { BaseIntegration } from "./base-integration";
import {
    SendTrackingParams,
    SendDeliveryStatusParams,
    GetShippingLabelParams,
    SendInvoiceParams,
    IntegrationResult,
    ShippingLabelResult
} from "../types/integration-params";

export abstract class EcommerceIntegration extends BaseIntegration {
    constructor () {
        super();
        this.type = IntegrationType.Ecommerce;
    }

    // === Standart Platform Bildirim Metodları ===
    abstract sendTracking(params: SendTrackingParams): Promise<IntegrationResult>;
    abstract sendDeliveryStatus(params: SendDeliveryStatusParams): Promise<IntegrationResult>;
    abstract getShippingLabel(params: GetShippingLabelParams): Promise<ShippingLabelResult>;
    abstract sendInvoice(params: SendInvoiceParams): Promise<IntegrationResult>;

    // === Mevcut Abstract Metodlar ===
    protected abstract syncProducts(): Promise<void>;
    protected abstract syncOrders(): Promise<void>;
    protected abstract updateStock(sku: string, quantity: number): Promise<void>;
    protected abstract updatePrice(sku: string, price: number): Promise<void>;
    protected abstract cancelOrder(orderId: string): Promise<void>;
}
