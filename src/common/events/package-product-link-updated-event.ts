import { FixStatus } from "../types/fix-status";
import { Subjects } from "./subjects";
import { ProductType } from "./types/product-type";

export interface PackageProductLinkUpdatedEvent {
    subject: Subjects.PackageProductLinkUpdated;
    data: {
        id: string;
        uuid: string;
        user: string;
        version: number;
        quantity: number;
        price: number;
        status: FixStatus;
        deleted?: boolean;
        deletionDate?: Date | null;
        product: {
            id: string;
            uuid: string;
            user: string;
            version: number;
            type: ProductType;
        };
        packageProduct: {
            id: string;
            uuid: string;
            user: string;
            version: number;
            type: ProductType;
        };
        uniqueCode?: string | null;
    };
}