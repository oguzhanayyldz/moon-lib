import mongoose, { Document, Model } from "mongoose";
import { SortType } from '../../common';
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
    isTemporary?: boolean;
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
    isTemporary?: boolean;
    destroy(): Promise<EmitReturnConfig>;
}
export interface EmitReturnConfig {
    id: string;
    entity: string;
    timestamp: string;
    userId?: string;
    metadata?: any;
}
export type MongoQuery<T> = {
    [P in keyof T]?: T[P] | {
        $in?: any[];
        $nin?: any[];
        $eq?: any;
        $gt?: any;
        $gte?: any;
        $lt?: any;
        $lte?: any;
    };
} & Record<string, any>;
export interface BaseModel<T extends BaseDoc, A extends BaseAttrs> extends Model<T> {
    build(attrs: A): T;
    findByCustom(id: string): Promise<T | null>;
    filter(where: Partial<A>, limit?: number, offset?: number, order?: SortType, populate?: any): Promise<T[] | null>;
    destroyMany(where: MongoQuery<A>): Promise<{
        matchedCount: number;
        modifiedCount: number;
        events: EmitReturnConfig[];
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
            deleted?: boolean | undefined;
            uuid?: string | undefined;
            deletionDate?: Date | undefined;
            uniqueCode?: string | undefined;
            isTemporary?: boolean | undefined;
            deletedBy?: {
                id: mongoose.Types.ObjectId;
                entity: string;
                timestamp: Date;
                reason?: string | undefined;
            } | undefined;
        }>> & mongoose.FlatRecord<{
            creationDate: Date;
            updatedOn: Date;
            deleted?: boolean | undefined;
            uuid?: string | undefined;
            deletionDate?: Date | undefined;
            uniqueCode?: string | undefined;
            isTemporary?: boolean | undefined;
            deletedBy?: {
                id: mongoose.Types.ObjectId;
                entity: string;
                timestamp: Date;
                reason?: string | undefined;
            } | undefined;
        }> & {
            _id: mongoose.Types.ObjectId;
        }, ret: Record<string, any>): void;
    };
}, {
    creationDate: Date;
    updatedOn: Date;
    deleted?: boolean | undefined;
    uuid?: string | undefined;
    deletionDate?: Date | undefined;
    uniqueCode?: string | undefined;
    isTemporary?: boolean | undefined;
    deletedBy?: {
        id: mongoose.Types.ObjectId;
        entity: string;
        timestamp: Date;
        reason?: string | undefined;
    } | undefined;
}, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    creationDate: Date;
    updatedOn: Date;
    deleted?: boolean | undefined;
    uuid?: string | undefined;
    deletionDate?: Date | undefined;
    uniqueCode?: string | undefined;
    isTemporary?: boolean | undefined;
    deletedBy?: {
        id: mongoose.Types.ObjectId;
        entity: string;
        timestamp: Date;
        reason?: string | undefined;
    } | undefined;
}>> & mongoose.FlatRecord<{
    creationDate: Date;
    updatedOn: Date;
    deleted?: boolean | undefined;
    uuid?: string | undefined;
    deletionDate?: Date | undefined;
    uniqueCode?: string | undefined;
    isTemporary?: boolean | undefined;
    deletedBy?: {
        id: mongoose.Types.ObjectId;
        entity: string;
        timestamp: Date;
        reason?: string | undefined;
    } | undefined;
}> & {
    _id: mongoose.Types.ObjectId;
}>;
export default createBaseSchema;
