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
    isTemporary?: boolean
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
        deletedBy: {
            type: {
                entity: {
                    type: String,  // Hangi entity türü silmeyi gerçekleştirdi (Product, Combination, vs.)
                    required: true
                },
                id: {
                    type: mongoose.Schema.Types.ObjectId,  // Silinen entity'nin ID'si
                    required: true
                },
                timestamp: {
                    type: Date,
                    default: Date.now,
                    required: true
                },
                reason: {
                    type: String  // Opsiyonel silme nedeni
                }
            }
        },
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
            const docsToDelete = await this.find(where).select('_id');
            const docIds = docsToDelete.map((doc: any) => doc._id);
            const entityType = this.collection.name.replace(/s$/, '');
            const deletedEvents = [];
            
            // Her kayıt için ayrı ayrı sil
            for (const docId of docIds) {
                const doc = await this.findById(docId);
                if (doc) {
                    doc.deletionDate = new Date();
                    doc.uniqueCode = `deleted-${uuidv4()}`; // Her kayıt için benzersiz bir değer oluştur
                    doc.deleted = true;
                    await doc.save();
                    
                    deletedEvents.push({
                        id: doc.id,
                        entity: entityType,
                        timestamp: new Date().toISOString()
                    });
                }
            }
            
            // Silinen belgelerin bilgilerini döndür
            return {
                matchedCount: docsToDelete.length,
                modifiedCount: deletedEvents.length,
                events: deletedEvents
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

    baseSchema.methods.destroy = async function (): Promise<EmitReturnConfig | undefined> {
        try {
            const instance = this as any;
            if (!instance.deletionDate) {
                instance.deletionDate = new Date();
            }
            instance.uniqueCode = `deleted-${uuidv4()}`; // Benzersiz değer için UUID kullan
            instance.deleted = true;
            await instance.save();
            
            // İşlem bilgisini ek veri olarak döndür (servisin erişebileceği)
            const constructor = instance.constructor as any;
            const entityType = constructor.collection ? constructor.collection.name.replace(/s$/, '') : '';
            
            // Bir event nesnesi döndür, bunu servis katmanı işleyecek
            return {
                id: instance.id,
                entity: entityType,
                timestamp: new Date().toISOString()
            };
        } catch (err) {
            console.error(err);
            return undefined; // Ensure a return value in case of an error
        }
    };
    // ... Diğer middleware'ler aynı şekilde eklenecek

    return baseSchema;
}

export default createBaseSchema;