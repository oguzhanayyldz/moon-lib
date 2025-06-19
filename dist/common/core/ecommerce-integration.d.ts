import { BaseIntegration } from "./base-integration";
export declare abstract class EcommerceIntegration extends BaseIntegration {
    constructor();
    protected abstract syncProducts(): Promise<void>;
    protected abstract syncOrders(): Promise<void>;
    protected abstract updateStock(sku: string, quantity: number): Promise<void>;
    protected abstract updatePrice(sku: string, price: number): Promise<void>;
    protected abstract cancelOrder(orderId: string): Promise<void>;
}
