import mongoose, { Document, Model, Query, Schema } from "mongoose";
import { updateIfCurrentPlugin } from "mongoose-update-if-current";
import { v4 as uuidv4 } from 'uuid';
import moment from "moment-timezone";
import { generateRandomString, SortType, getRefDataId } from '../../common';
import { EntityType, ServiceName } from '../../common/types';
import { Subjects } from '../../common/events';
import { logger } from '../../services/logger.service';

// ✅ Global Map: Model isimlerine göre version tracking config saklama
// Schema veya Model'e custom property eklemek çalışmadığı için global Map kullanıyoruz
export const VERSION_TRACKING_CONFIGS = new Map<string, {
    enableVersionTracking: boolean;
    versionTrackingConfig?: any;
}>();

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
        // Diğer operatörler
    };
} & Record<string, any>;

/**
 * BaseSchema Options
 * Optional version tracking configuration and source service tracking
 */
export interface BaseSchemaOptions {
    /**
     * Indicates which service owns this entity as the source of truth (native)
     *
     * Example: ProductStock schema in Inventory service should have:
     *   sourceService: ServiceName.Inventory
     *
     * This helps developers quickly identify whether a schema is native or foreign
     * when reviewing code. Leave undefined for foreign entity copies.
     */
    sourceService?: ServiceName;

    enableVersionTracking?: boolean;
    versionTrackingConfig?: {
        entityType: EntityType;
        serviceName: ServiceName;
        includeMetadata?: boolean;
        parentField?: string;  // Child entity ise parent field adı (ör: 'product', 'package')
        parentEntityType?: EntityType;  // Parent entity tipi (ör: EntityType.Product)
    };

}

export interface BaseModel<T extends BaseDoc, A extends BaseAttrs> extends Model<T> {
    build(attrs: A): T;
    findByCustom(id: string): Promise<T | null>;
    filter(where: Partial<A>, limit?: number, offset?: number, order?: SortType, populate?: any): Promise<T[] | null>;
    destroyMany(where: MongoQuery<A>): Promise<{ matchedCount: number, modifiedCount: number, events: EmitReturnConfig[] }>;
    findByEvent(event: { id: string, version: number }): Promise<T | null>;
}

/**
 * Lean query sonuçlarına `id` property ekler.
 * Mongoose'un `id` virtual getter'ı lean objelerde çalışmadığı için,
 * bu helper `_id` → `id` dönüşümünü uygular.
 * Populate edilmiş alt dokümanları da recursive olarak işler.
 */
function addIdToLeanDoc(doc: Record<string, unknown>): void {
    if (!doc || typeof doc !== 'object') return;

    if (doc._id && doc.id === undefined) {
        doc.id = doc._id.toString();
    }

    for (const key of Object.keys(doc)) {
        if (key === '_id') continue;
        const val = doc[key];
        if (Array.isArray(val)) {
            for (const item of val) {
                if (item && typeof item === 'object' && (item as Record<string, unknown>)._id) {
                    addIdToLeanDoc(item as Record<string, unknown>);
                }
            }
        } else if (val && typeof val === 'object' && (val as Record<string, unknown>)._id) {
            addIdToLeanDoc(val as Record<string, unknown>);
        }
    }
}

export function createBaseSchema(
    schemaDefinition: mongoose.SchemaDefinition = {},
    options: BaseSchemaOptions = {}
) {
    const baseSchema = new Schema({
        uuid: { type: String },
        creationDate: {
            type: Date,
            default: Date.now,
            required: true
        },
        updatedOn: {
            type: Date,
            default: Date.now,
            required: true
        },
        deletionDate: {
            type: Date
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
            
            // Her kayıt için versiyon kontrolünü bypass ederek silme işlemi
            for (const docId of docIds) {
                try {
                    // findByIdAndUpdate ile versiyon kontrolünü bypass ederek güncelleme
                    await this.findByIdAndUpdate(
                        docId,
                        {
                            $set: {
                                deletionDate: new Date(),
                                uniqueCode: `deleted-${docId}`,
                                deleted: true
                            }
                        },
                        { new: true }
                    );
                    
                    // Silinen belgenin bilgilerini olaylar listesine ekle
                    deletedEvents.push({
                        id: docId.toString(),
                        entity: entityType,
                        timestamp: new Date().toISOString()
                    });
                } catch (err) {
                    console.error(`Error deleting document ${docId}:`, err);
                    // Hata olsa bile diğer belgelerin silinmesine devam et
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

    // insertMany middleware'i: pre('save') hook'u insertMany'de BYPASS edilir, bu yuzden
    // `uniqueCode: null` ile toplu insert collection'daki unique index'e takilir
    // (E11000 duplicate key on uniqueCode: null). Bu middleware pre('save') ile aynen
    // davranir: uuid yoksa atar, uniqueCode yoksa turetir, updatedOn'u her doc icin set eder.
    baseSchema.pre('insertMany', function (next: any, docs: any[]) {
        if (!Array.isArray(docs) || docs.length === 0) {
            return next();
        }
        for (const doc of docs) {
            if (!doc) continue;
            if (!doc.uuid) doc.uuid = uuidv4();
            if (!doc.deleted && !doc.deletionDate && !doc.uniqueCode) {
                doc.uniqueCode = "base-" + new Date().getTime().toString() + "-" + generateRandomString(6);
            }
            doc.updatedOn = new Date();
        }
        next();
    });

    // 🆕 VERSION TRACKING POST-SAVE HOOK (OPTIONAL)
    if (options.enableVersionTracking && options.versionTrackingConfig) {
        // ✅ GLOBAL MAP: Config'i entityType key'i ile Map'e kaydet
        // publishVersionEventForUpdate metodu runtime'da buradan okuyacak
        const configKey = options.versionTrackingConfig.entityType;
        VERSION_TRACKING_CONFIGS.set(configKey, {
            enableVersionTracking: options.enableVersionTracking,
            versionTrackingConfig: options.versionTrackingConfig
        });

        const publishVersionEvent = async (doc: any, Model: any) => {
            const { entityType, serviceName, includeMetadata, parentField, parentEntityType } = options.versionTrackingConfig!;
            const docId = doc.id || doc._id?.toString();

            try {
                const previousVersion = doc.version - 1;

                // Parent entity bilgisini çıkar (child entity ise)
                let parentEntity: { entityType: EntityType; entityId: string } | undefined;
                if (parentField && parentEntityType && doc[parentField]) {
                    const parentId = doc[parentField]?.toString?.() || doc[parentField];
                    if (parentId) {
                        parentEntity = {
                            entityType: parentEntityType,
                            entityId: parentId
                        };
                    }
                }

                // Outbox model'ini al
                const Outbox = Model.db.model('Outbox');

                // EntityVersionUpdated event'ini Outbox'a ekle
                const outboxPayload = {
                    eventType: Subjects.EntityVersionUpdated,
                    payload: {
                        entityType,
                        entityId: docId,
                        service: serviceName,
                        version: doc.version,
                        previousVersion,
                        timestamp: new Date(),
                        userId: (doc as any).user?.toString?.() || (doc as any).user,
                        metadata: includeMetadata ? {
                            modelName: Model.modelName
                        } : undefined,
                        parentEntity  // Parent entity bilgisi
                    },
                    status: 'pending'
                };

                await Outbox.create(outboxPayload);
            } catch (error) {
                logger.error(`❌ [VERSION-TRACKING-ERROR] Publish failed for ${entityType}/${docId}:`, error);
                // Hata logla ama işlemi engelleme
            }
        };

        // POST-SAVE HOOK (create ve doc.save() update için)
        baseSchema.post<BaseDoc>('save', async function(doc, next) {
            try {
                const Model = this.constructor as any;
                await publishVersionEvent(doc, Model);
                next();
            } catch (error) {
                logger.error('❌ [VERSION-TRACKING-HOOK-ERROR] post(save) hook error:', error);
                next();
            }
        });

        // POST-FINDONEANDUPDATE HOOK (updateWithRetry için)
        baseSchema.post<BaseDoc>('findOneAndUpdate', async function(doc: any, next: any) {
            try {
                if (!doc) {
                    next();
                    return;
                }

                const Model = this.constructor as any;

                // Update query'den version bilgisini al
                const query = this as any;
                const update = query.getUpdate();
                const newVersion = update?.$set?.version;

                if (newVersion !== undefined) {
                    doc.version = newVersion;
                }

                await publishVersionEvent(doc, Model);
                next();
            } catch (error) {
                logger.error('❌ [VERSION-TRACKING-HOOK-ERROR] post(findOneAndUpdate) hook error:', error);
                next();
            }
        });
    }

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

    // Lean post hooks: .lean() ile dönen plain objelere `id` property ekler
    baseSchema.post('find', function (docs: Record<string, unknown>[]) {
        if ((this as any).mongooseOptions().lean && Array.isArray(docs)) {
            for (const doc of docs) { addIdToLeanDoc(doc); }
        }
    });

    baseSchema.post('findOne', function (doc: Record<string, unknown> | null) {
        if ((this as any).mongooseOptions().lean && doc) { addIdToLeanDoc(doc); }
    });

    baseSchema.post('findOneAndUpdate', function (doc: Record<string, unknown> | null) {
        if ((this as any).mongooseOptions().lean && doc) { addIdToLeanDoc(doc); }
    });

    // Slow Query Detection — 100ms üzeri sorgular loglanır
    const SLOW_QUERY_THRESHOLD_MS = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '100', 10);

    const queryTypes = ['find', 'findOne', 'countDocuments', 'distinct'] as const;
    for (const queryType of queryTypes) {
        baseSchema.pre(queryType, function (this: any) {
            this._startTime = Date.now();
        });

        baseSchema.post(queryType, function (this: any) {
            if (!this._startTime) return;
            const duration = Date.now() - this._startTime;
            if (duration > SLOW_QUERY_THRESHOLD_MS) {
                const modelName = this.model?.modelName || 'Unknown';
                const filter = JSON.stringify(this.getQuery?.() || {}).substring(0, 200);
                logger.warn(`🐢 Slow query detected: ${modelName}.${queryType} — ${duration}ms`, {
                    model: modelName,
                    operation: queryType,
                    duration,
                    filter,
                    service: process.env.SERVICE_NAME || 'unknown'
                });
            }
        });
    }

    baseSchema.methods.destroy = async function(): Promise<EmitReturnConfig | undefined> {
        try {
            const instance = this as BaseDoc;
            const Model = instance.constructor as any;
            
            // findByIdAndUpdate ile versiyon kontrolünü bypass ederek güncelleme yapar
            await Model.findByIdAndUpdate(
                instance.id,
                {
                    $set: {
                        deletionDate: new Date(),
                        uniqueCode: `deleted-${instance.id}`,
                        deleted: true
                    }
                },
                { new: true }
            );
            
            // Emit config'i döndür
            return {
                id: instance.id,
                entity: Model.modelName.toLowerCase(),
                timestamp: new Date().toISOString(),
                userId: (instance as any).user ? getRefDataId((instance as any).user) : undefined
            };
        } catch (err) {
            console.error('Destroy error:', err);
            throw err;
        }
    };
    // ... Diğer middleware'ler aynı şekilde eklenecek

    return baseSchema;
}

export default createBaseSchema;