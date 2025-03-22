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
    build(attrs: A, modelName: string): T;
    findByCustom(id: string, modelName: string): Promise<T | null>;
    filter(where: Partial<A>, modelName: string, limit?: number, offset?: number, order?: SortType): Promise<T[] | null>;
    destroyMany(where: Partial<A>, modelName: string): Promise<{
        matchedCount: number;
        modifiedCount: number;
    }>;
    findByEvent(event: {
        id: string;
        version: number;
    }, modelName: string): Promise<T | null>;
}
declare const BaseSchema: mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    toJSON: {
        transform(doc: mongoose.Document<unknown, {}, mongoose.FlatRecord<{
            creationDate: NativeDate;
            updatedOn: NativeDate;
            uuid?: string | null | undefined;
            deletionDate?: NativeDate | null | undefined;
            deleted?: boolean | null | undefined;
            uniqueCode?: string | null | undefined;
        }>> & mongoose.FlatRecord<{
            creationDate: NativeDate;
            updatedOn: NativeDate;
            uuid?: string | null | undefined;
            deletionDate?: NativeDate | null | undefined;
            deleted?: boolean | null | undefined;
            uniqueCode?: string | null | undefined;
        }> & {
            _id: mongoose.Types.ObjectId;
        } & {
            __v: number;
        }, ret: Record<string, any>): void;
    };
}, {
    creationDate: NativeDate;
    updatedOn: NativeDate;
    uuid?: string | null | undefined;
    deletionDate?: NativeDate | null | undefined;
    deleted?: boolean | null | undefined;
    uniqueCode?: string | null | undefined;
}, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    creationDate: NativeDate;
    updatedOn: NativeDate;
    uuid?: string | null | undefined;
    deletionDate?: NativeDate | null | undefined;
    deleted?: boolean | null | undefined;
    uniqueCode?: string | null | undefined;
}>> & mongoose.FlatRecord<{
    creationDate: NativeDate;
    updatedOn: NativeDate;
    uuid?: string | null | undefined;
    deletionDate?: NativeDate | null | undefined;
    deleted?: boolean | null | undefined;
    uniqueCode?: string | null | undefined;
}> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
export default BaseSchema;
