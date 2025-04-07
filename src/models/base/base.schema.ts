import mongoose, { Document, Model, Query, Schema } from "mongoose";
import { updateIfCurrentPlugin } from "mongoose-update-if-current";
import { v4 as uuidv4 } from 'uuid';
import moment from "moment-timezone";
import { generateRandomString, SortType } from "@xmoonx/common";

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
    isTemporary?:boolean
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
    destroy(): Promise<void>;
}

export interface BaseModel<T extends BaseDoc, A extends BaseAttrs> extends Model<T> {
    build(attrs: A): T;
    findByCustom(id: string): Promise<T | null>;
    filter(where: Partial<A>, limit?: number, offset?: number, order?: SortType, populate?: any): Promise<T[] | null>;
    destroyMany(where: Partial<A>): Promise<{ matchedCount: number, modifiedCount: number }>;
    findByEvent(event: { id: string, version: number }): Promise<T | null>;
}

export function createBaseSchema(schemaDefinition: mongoose.SchemaDefinition = {}) {
    const baseSchema = new Schema({
        uuid: { type: String },
        creationDate: {
            type: Date,
            default: Date.now,
            required: true,
            timezone: 'Europe/Istanbul',
            get: (val: any) => moment(val).tz('Europe/Istanbul').format()
        },
        updatedOn: {
            type: Date,
            default: Date.now,
            required: true,
            timezone: 'Europe/Istanbul',
            get: (val: any) => moment(val).tz('Europe/Istanbul').format()
        },
        deletionDate: {
            type: Date,
            timezone: 'Europe/Istanbul',
            get: (val: any) => val ? moment(val).tz('Europe/Istanbul').format() : undefined
        },
        deleted: { type: Boolean },
        uniqueCode: { type: String, unique: true },
        isTemporary: { type: Boolean },
        ...schemaDefinition
    }, {
        toJSON: {
            transform(doc, ret) {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
            }
        }
    });

    baseSchema.set('versionKey', 'version');
    baseSchema.plugin(updateIfCurrentPlugin);
    baseSchema.set('toJSON', { getters: true });
    baseSchema.set('toObject', { getters: true });

    // Static methods
    baseSchema.statics = {
        build: function (attrs: BaseAttrs) {
            if (attrs && attrs.id) {
                attrs._id = attrs.id;
                delete attrs.id;
            }
            return new this(attrs);
        },

        findByCustom: function (id: string) {
            return this.findById(id)
                .where({ deletionDate: { $exists: false }, deleted: { $exists: false } })
                .exec();
        },

        findByEvent: function (event: { id: string, version: number }) {
            return this.findOne({
                _id: event.id,
                version: event.version - 1,
                deletionDate: { $exists: false },
                deleted: { $exists: false }
            });
        },

        filter: function (
            where: any,
            limit = 20,
            offset = 0,
            order?: SortType,
            populate?: any,
        ) {
            return this.find()
                .where(where)
                .populate(populate)
                .sort(order)
                .skip(offset)
                .limit(limit)
                .exec();
        },

        destroyMany: async function (where: any) {
            const updateResult = await this.updateMany(where, {
                $set: {
                    deletionDate: new Date(),
                    uniqueCode: new Date().getTime().toString() + "-" + generateRandomString(4),
                    deleted: true
                }
            });

            return {
                matchedCount: updateResult.matchedCount,
                modifiedCount: updateResult.modifiedCount
            };
        }
    };

    // ... Diğer static metodlar aynı şekilde eklenecek

    // Middleware'ler
    baseSchema.pre<BaseDoc>('save', async function (next) {
        if (!this.uuid) this.uuid = uuidv4();
        if (!this.deleted && !this.deletionDate && !this.uniqueCode) {
            this.uniqueCode = "base-" + new Date().getTime().toString() + "-" + generateRandomString(6);
        }
        this.updatedOn = new Date();
        next();
    });

    baseSchema.pre<BaseDoc>('findOneAndUpdate', function (next) {
        const filter = (this as any).getQuery();
        this.updateOne(filter, { $set: { updatedOn: new Date() } });
        next();
    });

    baseSchema.pre<BaseDoc>('updateOne', function (next) {
        const filter = (this as any).getQuery();
        this.updateOne(filter, { $set: { updatedOn: new Date() } });
        next();
    });

    baseSchema.pre<BaseDoc>('find', function (next) {
        const query = (this as any) as Query<BaseDoc[], BaseDoc>;
        const queryConditions = query.getQuery();
        const includeDeleted = queryConditions.includeDeleted;
        delete queryConditions.includeDeleted;

        if (!includeDeleted) {
            query.where({ deletionDate: { $exists: false }, deleted: { $exists: false } });
        }
        next();
    });

    baseSchema.pre<BaseDoc>('findOne', function (next) {
        const query = (this as any) as Query<BaseDoc, BaseDoc>;
        const queryConditions = query.getQuery();
        const includeDeleted = queryConditions.includeDeleted;
        delete queryConditions.includeDeleted;

        if (!includeDeleted) {
            query.where({ deletionDate: { $exists: false }, deleted: { $exists: false } });
        }
        next();
    });

    baseSchema.methods.destroy = async function (): Promise<void> {
        try {
            const instance = this as BaseDoc;
            if (!instance.deletionDate) {
                instance.deletionDate = new Date();
            }
            instance.uniqueCode = new Date().getTime().toString() + "-" + generateRandomString(6);
            instance.deleted = true;
            await instance.save();
        } catch (err) {
            console.error(err);
        }
    };
    // ... Diğer middleware'ler aynı şekilde eklenecek

    return baseSchema;
}

export default createBaseSchema;