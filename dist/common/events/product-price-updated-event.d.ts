import { Subjects } from "./subjects";
import { ResourceName } from "../types/resourceName";
export interface ProductPriceUpdatedEvent {
    subject: Subjects.ProductPriceUpdated;
    data: {
        requestId: string;
        userId: string;
        list: ProductPriceUpdated[];
        integrationName?: ResourceName;
    };
}
export interface ProductPriceUpdated {
    id: string;
    product: string;
    combination?: string;
    price: number;
    listPrice?: number;
    version: number;
    source: ResourceName;
    integrationName?: ResourceName;
    sourceTimestamp: Date;
    updateRequestId?: string;
}
