import { Subjects } from "./subjects";
import { UnitType } from "../types/unit-type";
export interface ProductStockUpdatedEvent {
    subject: Subjects.ProductStockUpdated;
    data: {
        id: string;
        uuid: string;
        user: string;
        version: number;
        quantity: number;
        rezervedQuantity: number;
        unitType: UnitType;
        productId: string;
        combinationId?: string | null;
        uniqueCode?: string | null;
        deleted?: boolean;
        deletionDate?: Date | null;
    };
}
