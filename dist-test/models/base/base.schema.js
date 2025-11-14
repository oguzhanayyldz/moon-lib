"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBaseSchema = createBaseSchema;
const mongoose_1 = __importStar(require("mongoose"));
const mongoose_update_if_current_1 = require("mongoose-update-if-current");
const uuid_1 = require("uuid");
const common_1 = require("../../common");
const events_1 = require("../../common/events");
const logger_service_1 = require("../../services/logger.service");
function createBaseSchema(schemaDefinition = {}, options = {}) {
    const baseSchema = new mongoose_1.Schema(Object.assign({ uuid: { type: String }, creationDate: {
            type: Date,
            default: Date.now,
            required: true
        }, updatedOn: {
            type: Date,
            default: Date.now,
            required: true
        }, deletionDate: {
            type: Date
        }, deleted: { type: Boolean }, uniqueCode: { type: String, unique: true }, isTemporary: { type: Boolean }, deletedBy: {
            type: {
                entity: {
                    type: String, // Hangi entity türü silmeyi gerçekleştirdi (Product, Combination, vs.)
                    required: true
                },
                id: {
                    type: mongoose_1.default.Schema.Types.ObjectId, // Silinen entity'nin ID'si
                    required: true
                },
                timestamp: {
                    type: Date,
                    default: Date.now,
                    required: true
                },
                reason: {
                    type: String // Opsiyonel silme nedeni
                }
            }
        } }, schemaDefinition), {
        toJSON: {
            transform(doc, ret) {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
            }
        }
    });
    baseSchema.set('versionKey', 'version');
    baseSchema.plugin(mongoose_update_if_current_1.updateIfCurrentPlugin);
    baseSchema.set('toJSON', { getters: true });
    baseSchema.set('toObject', { getters: true });
    // Static methods
    baseSchema.statics = {
        build: function (attrs) {
            if (attrs && attrs.id) {
                attrs._id = attrs.id;
                delete attrs.id;
            }
            return new this(attrs);
        },
        findByCustom: function (id) {
            return this.findById(id)
                .where({ deletionDate: { $exists: false }, deleted: { $exists: false } })
                .exec();
        },
        findByEvent: function (event) {
            return this.findOne({
                _id: event.id,
                version: event.version - 1,
                deletionDate: { $exists: false },
                deleted: { $exists: false }
            });
        },
        filter: function (where, limit = 20, offset = 0, order, populate) {
            return this.find()
                .where(where)
                .populate(populate)
                .sort(order)
                .skip(offset)
                .limit(limit)
                .exec();
        },
        destroyMany: async function (where) {
            const docsToDelete = await this.find(where).select('_id');
            const docIds = docsToDelete.map((doc) => doc._id);
            const entityType = this.collection.name.replace(/s$/, '');
            const deletedEvents = [];
            // Her kayıt için versiyon kontrolünü bypass ederek silme işlemi
            for (const docId of docIds) {
                try {
                    // findByIdAndUpdate ile versiyon kontrolünü bypass ederek güncelleme
                    await this.findByIdAndUpdate(docId, {
                        $set: {
                            deletionDate: new Date(),
                            uniqueCode: `deleted-${docId}`,
                            deleted: true
                        }
                    }, { new: true });
                    // Silinen belgenin bilgilerini olaylar listesine ekle
                    deletedEvents.push({
                        id: docId.toString(),
                        entity: entityType,
                        timestamp: new Date().toISOString()
                    });
                }
                catch (err) {
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
    baseSchema.pre('save', async function (next) {
        if (!this.uuid)
            this.uuid = (0, uuid_1.v4)();
        if (!this.deleted && !this.deletionDate && !this.uniqueCode) {
            this.uniqueCode = "base-" + new Date().getTime().toString() + "-" + (0, common_1.generateRandomString)(6);
        }
        this.updatedOn = new Date();
        next();
    });
    // 🆕 VERSION TRACKING POST-SAVE HOOK (OPTIONAL)
    if (options.enableVersionTracking && options.versionTrackingConfig) {
        logger_service_1.logger.info(`🔧 [VERSION-TRACKING-INIT] Enabled for ${options.versionTrackingConfig.entityType} in ${options.versionTrackingConfig.serviceName}`);
        const publishVersionEvent = async (doc, Model) => {
            var _a, _b, _c, _d, _e;
            const { entityType, serviceName, includeMetadata, parentField, parentEntityType } = options.versionTrackingConfig;
            const docId = doc.id || ((_a = doc._id) === null || _a === void 0 ? void 0 : _a.toString());
            logger_service_1.logger.info(`🚀 [VERSION-TRACKING-PUBLISH] START: ${entityType}/${docId} v${doc.version} (service: ${serviceName})`);
            try {
                const previousVersion = doc.version - 1;
                // Parent entity bilgisini çıkar (child entity ise)
                let parentEntity;
                if (parentField && parentEntityType && doc[parentField]) {
                    const parentId = ((_c = (_b = doc[parentField]) === null || _b === void 0 ? void 0 : _b.toString) === null || _c === void 0 ? void 0 : _c.call(_b)) || doc[parentField];
                    if (parentId) {
                        parentEntity = {
                            entityType: parentEntityType,
                            entityId: parentId
                        };
                        logger_service_1.logger.info(`👨‍👦 [VERSION-TRACKING-PARENT] Parent entity detected: ${parentEntityType}/${parentId}`);
                    }
                }
                // Outbox model'ini al
                logger_service_1.logger.info(`📦 [VERSION-TRACKING-OUTBOX] Retrieving Outbox model from db...`);
                const Outbox = Model.db.model('Outbox');
                logger_service_1.logger.info(`✅ [VERSION-TRACKING-OUTBOX] Outbox model retrieved successfully`);
                // EntityVersionUpdated event'ini Outbox'a ekle
                const outboxPayload = {
                    eventType: events_1.Subjects.EntityVersionUpdated,
                    payload: {
                        entityType,
                        entityId: docId,
                        service: serviceName,
                        version: doc.version,
                        previousVersion,
                        timestamp: new Date(),
                        userId: ((_e = (_d = doc.user) === null || _d === void 0 ? void 0 : _d.toString) === null || _e === void 0 ? void 0 : _e.call(_d)) || doc.user,
                        metadata: includeMetadata ? {
                            modelName: Model.modelName
                        } : undefined,
                        parentEntity // ← YENİ: Parent entity bilgisi
                    },
                    status: 'pending'
                };
                logger_service_1.logger.info(`💾 [VERSION-TRACKING-CREATE] Creating Outbox entry...`, {
                    entityType,
                    entityId: docId,
                    version: doc.version
                });
                await Outbox.create(outboxPayload);
                logger_service_1.logger.info(`✅ [VERSION-TRACKING-SUCCESS] Version tracking: ${entityType}/${docId} v${doc.version} → Outbox (previousVersion: ${previousVersion})`);
            }
            catch (error) {
                logger_service_1.logger.error(`❌ [VERSION-TRACKING-ERROR] Publish failed for ${entityType}/${docId}:`, error);
                logger_service_1.logger.error(`❌ [VERSION-TRACKING-ERROR-DETAIL]`, {
                    entityType,
                    entityId: docId,
                    version: doc.version,
                    service: serviceName,
                    errorMessage: error.message,
                    errorStack: error.stack
                });
                // Hata logla ama işlemi engelleme
            }
        };
        // POST-SAVE HOOK (create ve update için)
        baseSchema.post('save', async function (doc, next) {
            logger_service_1.logger.info(`🎣 [VERSION-TRACKING-HOOK] post('save') TRIGGERED for doc: ${doc.id || doc._id}`);
            try {
                const Model = this.constructor;
                logger_service_1.logger.info(`🎣 [VERSION-TRACKING-HOOK] Model name: ${Model.modelName}`);
                await publishVersionEvent(doc, Model);
                logger_service_1.logger.info(`🎣 [VERSION-TRACKING-HOOK] post('save') completed successfully`);
                next();
            }
            catch (error) {
                logger_service_1.logger.error('❌ [VERSION-TRACKING-HOOK-ERROR] post(save) hook error:', error);
                next();
            }
        });
        // POST-FINDONEANDUPDATE HOOK (updateWithRetry için)
        baseSchema.post('findOneAndUpdate', async function (doc, next) {
            logger_service_1.logger.info(`🎣 [VERSION-TRACKING-HOOK] post('findOneAndUpdate') TRIGGERED for doc: ${doc ? (doc.id || doc._id) : 'null'}`);
            try {
                if (!doc) {
                    logger_service_1.logger.warn(`⚠️ [VERSION-TRACKING-HOOK] post('findOneAndUpdate') - doc is null, skipping`);
                    next();
                    return;
                }
                const Model = this.constructor;
                logger_service_1.logger.info(`🎣 [VERSION-TRACKING-HOOK] Model name: ${Model.modelName}`);
                await publishVersionEvent(doc, Model);
                logger_service_1.logger.info(`🎣 [VERSION-TRACKING-HOOK] post('findOneAndUpdate') completed successfully`);
                next();
            }
            catch (error) {
                logger_service_1.logger.error('❌ [VERSION-TRACKING-HOOK-ERROR] post(findOneAndUpdate) hook error:', error);
                next();
            }
        });
        logger_service_1.logger.info(`✅ [VERSION-TRACKING-INIT] Hooks registered successfully for ${options.versionTrackingConfig.entityType} in ${options.versionTrackingConfig.serviceName}`);
    }
    baseSchema.pre('findOneAndUpdate', function (next) {
        const filter = this.getQuery();
        this.updateOne(filter, { $set: { updatedOn: new Date() } });
        next();
    });
    baseSchema.pre('updateOne', function (next) {
        const filter = this.getQuery();
        this.updateOne(filter, { $set: { updatedOn: new Date() } });
        next();
    });
    baseSchema.pre('find', function (next) {
        const query = this;
        const queryConditions = query.getQuery();
        const includeDeleted = queryConditions.includeDeleted;
        delete queryConditions.includeDeleted;
        if (!includeDeleted) {
            query.where({ deletionDate: { $exists: false }, deleted: { $exists: false } });
        }
        next();
    });
    baseSchema.pre('findOne', function (next) {
        const query = this;
        const queryConditions = query.getQuery();
        const includeDeleted = queryConditions.includeDeleted;
        delete queryConditions.includeDeleted;
        if (!includeDeleted) {
            query.where({ deletionDate: { $exists: false }, deleted: { $exists: false } });
        }
        next();
    });
    baseSchema.methods.destroy = async function () {
        try {
            const instance = this;
            const Model = instance.constructor;
            // findByIdAndUpdate ile versiyon kontrolünü bypass ederek güncelleme yapar
            await Model.findByIdAndUpdate(instance.id, {
                $set: {
                    deletionDate: new Date(),
                    uniqueCode: `deleted-${instance.id}`,
                    deleted: true
                }
            }, { new: true });
            // Emit config'i döndür
            return {
                id: instance.id,
                entity: Model.modelName.toLowerCase(),
                timestamp: new Date().toISOString(),
                userId: instance.user ? (0, common_1.getRefDataId)(instance.user) : undefined
            };
        }
        catch (err) {
            console.error('Destroy error:', err);
            throw err;
        }
    };
    // ... Diğer middleware'ler aynı şekilde eklenecek
    return baseSchema;
}
exports.default = createBaseSchema;
//# sourceMappingURL=base.schema.js.map