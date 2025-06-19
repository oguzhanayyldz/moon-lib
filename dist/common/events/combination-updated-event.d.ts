import { AttributesType } from "../types/attributes-type";
import { FixStatus } from "../types/fix-status";
import { Subjects } from "./subjects";
import { ProductType } from "./types/product-type";
export interface CombinationUpdatedEvent {
    subject: Subjects.CombinationUpdated;
    data: {
        id: string;
        uuid: string;
        user: string;
        version: number;
        barcode: string;
        sku: string;
        status: FixStatus;
        erpId?: string | null;
        sort?: number | null;
        attributes?: AttributesType;
        deleted?: boolean;
        deletionDate?: Date | null;
        product: {
            id: string;
            uuid: string;
            user: string;
            version: number;
            type: ProductType;
        };
        uniqueCode?: string | null;
    };
}
