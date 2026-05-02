import { Subjects } from "./subjects";
import { UnitType } from "../types/unit-type";
export interface ProductStockBulkUpdatedEvent {
    subject: Subjects.ProductStockBulkUpdated;
    data: {
        requestId: string;
        userId: string;
        items: Array<{
            id: string;
            uuid: string;
            version: number;
            quantity: number;
            rezervedQuantity: number;
            unitType?: UnitType;
            productId: string;
            combinationId?: string | null;
            uniqueCode?: string | null;
        }>;
        source?: string;
        timestamp: Date;
    };
}
