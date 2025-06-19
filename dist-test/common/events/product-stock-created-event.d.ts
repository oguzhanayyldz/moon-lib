import { Subjects } from "./subjects";
import { UnitType } from "../types/unit-type";
export interface ProductStockCreatedEvent {
    subject: Subjects.ProductStockCreated;
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
        creationDate?: Date;
        updatedOn?: Date;
        uniqueCode?: string | null;
    };
}
//# sourceMappingURL=product-stock-created-event.d.ts.map