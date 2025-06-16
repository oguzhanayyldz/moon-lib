import { IntegrationType } from "../types/integration-type";
import { BaseIntegration } from "./base-integration";

export abstract class MarketPlaceIntegration extends BaseIntegration {
    constructor () {
        super();
        this.type = IntegrationType.MarketPlace;
    }

    protected abstract syncProducts(): Promise<void>;
    protected abstract syncOrders(): Promise<void>;
    protected abstract updateStock(sku: string, quantity: number): Promise<void>;
    protected abstract updatePrice(sku: string, price: number): Promise<void>;
    protected abstract cancelOrder(orderId: string): Promise<void>;
}
