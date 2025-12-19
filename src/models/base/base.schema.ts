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

    // 🆕 VERSION TRACKING POST-SAVE HOOK (OPTIONAL)
    if (options.enableVersionTracking && options.versionTrackingConfig) {
        // ✅ GLOBAL MAP: Config'i entityType key'i ile Map'e kaydet
        // publishVersionEventForUpdate metodu runtime'da buradan okuyacak
        const configKey = options.versionTrackingConfig.entityType;
        VERSION_TRACKING_CONFIGS.set(configKey, {
            enableVersionTracking: options.enableVersionTracking,
            versionTrackingConfig: options.versionTrackingConfig
        });
        logger.info(`🔧 [VERSION-TRACKING-INIT] Enabled for ${options.versionTrackingConfig.entityType} in ${options.versionTrackingConfig.serviceName}`);

        const publishVersionEvent = async (doc: any, Model: any) => {
            const { entityType, serviceName, includeMetadata, parentField, parentEntityType } = options.versionTrackingConfig!;
            const docId = doc.id || doc._id?.toString();

            logger.info(`🚀 [VERSION-TRACKING-PUBLISH] START: ${entityType}/${docId} v${doc.version} (service: ${serviceName})`);

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
                        logger.info(`👨‍👦 [VERSION-TRACKING-PARENT] Parent entity detected: ${parentEntityType}/${parentId}`);
                    }
                }

                // Outbox model'ini al
                logger.info(`📦 [VERSION-TRACKING-OUTBOX] Retrieving Outbox model from db...`);
                const Outbox = Model.db.model('Outbox');
                logger.info(`✅ [VERSION-TRACKING-OUTBOX] Outbox model retrieved successfully`);

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
                        parentEntity  // ← YENİ: Parent entity bilgisi
                    },
                    status: 'pending'
                };

                logger.info(`💾 [VERSION-TRACKING-CREATE] Creating Outbox entry...`, {
                    entityType,
                    entityId: docId,
                    version: doc.version
                });

                await Outbox.create(outboxPayload);

                logger.info(`✅ [VERSION-TRACKING-SUCCESS] Version tracking: ${entityType}/${docId} v${doc.version} → Outbox (previousVersion: ${previousVersion})`);
            } catch (error) {
                logger.error(`❌ [VERSION-TRACKING-ERROR] Publish failed for ${entityType}/${docId}:`, error);
                logger.error(`❌ [VERSION-TRACKING-ERROR-DETAIL]`, {
                    entityType,
                    entityId: docId,
                    version: doc.version,
                    service: serviceName,
                    errorMessage: (error as Error).message,
                    errorStack: (error as Error).stack
                });
                // Hata logla ama işlemi engelleme
            }
        };

        // POST-SAVE HOOK (create ve doc.save() update için)
        baseSchema.post<BaseDoc>('save', async function(doc, next) {
            logger.info(`🎣 [VERSION-TRACKING-HOOK] post('save') TRIGGERED for doc: ${doc.id || doc._id}`);
            try {
                const Model = this.constructor as any;
                logger.info(`🎣 [VERSION-TRACKING-HOOK] Model name: ${Model.modelName}, doc.version: ${doc.version}`);

                await publishVersionEvent(doc, Model);
                logger.info(`🎣 [VERSION-TRACKING-HOOK] post('save') completed successfully with version: ${doc.version}`);
                next();
            } catch (error) {
                logger.error('❌ [VERSION-TRACKING-HOOK-ERROR] post(save) hook error:', error);
                next();
            }
        });

        // POST-FINDONEANDUPDATE HOOK (updateWithRetry için)
        baseSchema.post<BaseDoc>('findOneAndUpdate', async function(doc: any, next: any) {
            logger.info(`🎣 [VERSION-TRACKING-HOOK] post('findOneAndUpdate') TRIGGERED for doc: ${doc ? (doc.id || doc._id) : 'null'}`);
            try {
                if (!doc) {
                    logger.warn(`⚠️ [VERSION-TRACKING-HOOK] post('findOneAndUpdate') - doc is null, skipping`);
                    next();
                    return;
                }

                const Model = this.constructor as any;
                logger.info(`🎣 [VERSION-TRACKING-HOOK] Model name: ${Model.modelName}, doc.version from hook param: ${doc.version}`);

                // ✅ FIX: Update query'den version bilgisini al
                // mongoose-update-if-current plugin ile manuel $set충돌 sorunu çözümü
                const query = this as any;  // Query context
                const update = query.getUpdate();
                const newVersion = update?.$set?.version;

                if (newVersion !== undefined) {
                    logger.info(`🔧 [VERSION-TRACKING-HOOK] Overriding doc.version from ${doc.version} to ${newVersion} (from update query)`);
                    doc.version = newVersion;
                }

                logger.info(`🎣 [VERSION-TRACKING-HOOK] Publishing event with version: ${doc.version}`);
                await publishVersionEvent(doc, Model);
                logger.info(`🎣 [VERSION-TRACKING-HOOK] post('findOneAndUpdate') completed successfully`);
                next();
            } catch (error) {
                logger.error('❌ [VERSION-TRACKING-HOOK-ERROR] post(findOneAndUpdate) hook error:', error);
                next();
            }
        });

        logger.info(`✅ [VERSION-TRACKING-INIT] Hooks registered successfully for ${options.versionTrackingConfig.entityType} in ${options.versionTrackingConfig.serviceName}`);
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