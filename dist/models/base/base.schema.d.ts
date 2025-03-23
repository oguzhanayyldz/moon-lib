import mongoose, { Document, Model } from "mongoose";
import { SortType } from "@xmoonx/common";
export interface BaseAttrs {
    id?: string;
    _id?: string;
    uuid?: string;
    version?: number;
    creationDate?: Date;
    updatedOn?: Date;
    deletionDate?: Date;
    deleted?: boolean;
    uniqueCode?: string | null;
}
export interface BaseDoc extends Document {
    id: string;
    uuid: string;
    version: number;
    creationDate: Date;
    updatedOn: Date;
    deletionDate: Date;
    deleted: boolean;
    uniqueCode: string;
    destroy(): Promise<void>;
}
export interface BaseModel<T extends BaseDoc, A extends BaseAttrs> extends Model<T> {
    build(attrs: A): T;
    findByCustom(id: string): Promise<T | null>;
    filter(where: Partial<A>, limit?: number, offset?: number, order?: SortType): Promise<T[] | null>;
    destroyMany(where: Partial<A>): Promise<{
        matchedCount: number;
        modifiedCount: number;
    }>;
    findByEvent(event: {
        id: string;
        version: number;
    }): Promise<T | null>;
}
export declare function createBaseSchema(schemaDefinition?: mongoose.SchemaDefinition): mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    toJSON: {
        transform(doc: mongoose.Document<unknown, {}, mongoose.FlatRecord<{
            creationDate: Date;
            updatedOn: Date;
            uuid?: string | undefined;
            deletionDate?: Date | undefined;
            deleted?: boolean | undefined;
            uniqueCode?: string | undefined;
        }>> & mongoose.FlatRecord<{
            creationDate: Date;
            updatedOn: Date;
            uuid?: string | undefined;
            deletionDate?: Date | undefined;
            deleted?: boolean | undefined;
            uniqueCode?: string | undefined;
        }> & {
            _id: mongoose.Types.ObjectId;
        }, ret: Record<string, any>): void;
    };
}, {
    creationDate: Date;
    updatedOn: Date;
    uuid?: string | undefined;
    deletionDate?: Date | undefined;
    deleted?: boolean | undefined;
    uniqueCode?: string | undefined;
}, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    creationDate: Date;
    updatedOn: Date;
    uuid?: string | undefined;
    deletionDate?: Date | undefined;
    deleted?: boolean | undefined;
    uniqueCode?: string | undefined;
}>> & mongoose.FlatRecord<{
    creationDate: Date;
    updatedOn: Date;
    uuid?: string | undefined;
    deletionDate?: Date | undefined;
    deleted?: boolean | undefined;
    uniqueCode?: string | undefined;
}> & {
    _id: mongoose.Types.ObjectId;
}>;
export default createBaseSchema;
