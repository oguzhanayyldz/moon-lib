import { Subjects } from "./subjects";
import { ProductType } from "./types/product-type";

export interface RelationProductLinkCreatedEvent {
    subject: Subjects.RelationProductLinkCreated;
    data: {
        id: string;
        uuid: string;
        user: string;
        version: number;
        product: {
            id: string;
            uuid: string;
            user: string;
            version: number;
            type: ProductType;
        };
        relatedProduct: {
            id: string;
            uuid: string;
            user: string;
            version: number;
            type: ProductType;
        };
        uniqueCode?: string | null;
    };
}