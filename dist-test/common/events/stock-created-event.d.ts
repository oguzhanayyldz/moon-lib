import { Subjects } from "./subjects";
import { UnitType } from '../types/unit-type';
export interface StockCreatedEvent {
    subject: Subjects.StockCreated;
    data: {
        id: string;
        uuid: string;
        user: string;
        version: number;
        product: string;
        combination?: string | null;
        barcode: string;
        shelfBarcode: string;
        shelfAlternativeId: number;
        unitType?: UnitType;
        row: number;
        column: number;
        quantity: number;
        rezervedQuantity: number;
        uniqueCode?: string | null;
        creationDate?: Date;
        updatedOn?: Date;
    };
}
//# sourceMappingURL=stock-created-event.d.ts.map