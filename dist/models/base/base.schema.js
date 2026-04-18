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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERSION_TRACKING_CONFIGS = void 0;
exports.createBaseSchema = createBaseSchema;
const mongoose_1 = __importStar(require("mongoose"));
const mongoose_update_if_current_1 = require("mongoose-update-if-current");
const uuid_1 = require("uuid");
const common_1 = require("../../common");
const events_1 = require("../../common/events");
const logger_service_1 = require("../../services/logger.service");
// ✅ Global Map: Model isimlerine göre version tracking config saklama
// Schema veya Model'e custom property eklemek çalışmadığı için global Map kullanıyoruz
exports.VERSION_TRACKING_CONFIGS = new Map();
/**
 * Lean query sonuçlarına `id` property ekler.
 * Mongoose'un `id` virtual getter'ı lean objelerde çalışmadığı için,
 * bu helper `_id` → `id` dönüşümünü uygular.
 * Populate edilmiş alt dokümanları da recursive olarak işler.
 */
function addIdToLeanDoc(doc) {
    if (!doc || typeof doc !== 'object')
        return;
    if (doc._id && doc.id === undefined) {
        doc.id = doc._id.toString();
    }
    for (const key of Object.keys(doc)) {
        if (key === '_id')
            continue;
        const val = doc[key];
        if (Array.isArray(val)) {
            for (const item of val) {
                if (item && typeof item === 'object' && item._id) {
                    addIdToLeanDoc(item);
                }
            }
        }
        else if (val && typeof val === 'object' && val._id) {
            addIdToLeanDoc(val);
        }
    }
}
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
        destroyMany: function (where) {
            return __awaiter(this, void 0, void 0, function* () {
                const docsToDelete = yield this.find(where).select('_id');
                const docIds = docsToDelete.map((doc) => doc._id);
                const entityType = this.collection.name.replace(/s$/, '');
                const deletedEvents = [];
                // Her kayıt için versiyon kontrolünü bypass ederek silme işlemi
                for (const docId of docIds) {
                    try {
                        // findByIdAndUpdate ile versiyon kontrolünü bypass ederek güncelleme
                        yield this.findByIdAndUpdate(docId, {
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
            });
        }
    };
    // ... Diğer static metodlar aynı şekilde eklenecek
    // Middleware'ler
    baseSchema.pre('save', function (next) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.uuid)
                this.uuid = (0, uuid_1.v4)();
            if (!this.deleted && !this.deletionDate && !this.uniqueCode) {
                this.uniqueCode = "base-" + new Date().getTime().toString() + "-" + (0, common_1.generateRandomString)(6);
            }
            this.updatedOn = new Date();
            next();
        });
    });
    // insertMany middleware'i: pre('save') hook'u insertMany'de BYPASS edilir, bu yuzden
    // `uniqueCode: null` ile toplu insert collection'daki unique index'e takilir
    // (E11000 duplicate key on uniqueCode: null). Bu middleware pre('save') ile aynen
    // davranir: uuid yoksa atar, uniqueCode yoksa turetir, updatedOn'u her doc icin set eder.
    baseSchema.pre('insertMany', function (next, docs) {
        if (!Array.isArray(docs) || docs.length === 0) {
            return next();
        }
        for (const doc of docs) {
            if (!doc)
                continue;
            if (!doc.uuid)
                doc.uuid = (0, uuid_1.v4)();
            if (!doc.deleted && !doc.deletionDate && !doc.uniqueCode) {
                doc.uniqueCode = "base-" + new Date().getTime().toString() + "-" + (0, common_1.generateRandomString)(6);
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
        exports.VERSION_TRACKING_CONFIGS.set(configKey, {
            enableVersionTracking: options.enableVersionTracking,
            versionTrackingConfig: options.versionTrackingConfig
        });
        const publishVersionEvent = (doc, Model) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            const { entityType, serviceName, includeMetadata, parentField, parentEntityType } = options.versionTrackingConfig;
            const docId = doc.id || ((_a = doc._id) === null || _a === void 0 ? void 0 : _a.toString());
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
                    }
                }
                // Outbox model'ini al
                const Outbox = Model.db.model('Outbox');
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
                        parentEntity // Parent entity bilgisi
                    },
                    status: 'pending'
                };
                yield Outbox.create(outboxPayload);
            }
            catch (error) {
                logger_service_1.logger.error(`❌ [VERSION-TRACKING-ERROR] Publish failed for ${entityType}/${docId}:`, error);
                // Hata logla ama işlemi engelleme
            }
        });
        // POST-SAVE HOOK (create ve doc.save() update için)
        baseSchema.post('save', function (doc, next) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    const Model = this.constructor;
                    yield publishVersionEvent(doc, Model);
                    next();
                }
                catch (error) {
                    logger_service_1.logger.error('❌ [VERSION-TRACKING-HOOK-ERROR] post(save) hook error:', error);
                    next();
                }
            });
        });
        // POST-FINDONEANDUPDATE HOOK (updateWithRetry için)
        baseSchema.post('findOneAndUpdate', function (doc, next) {
            return __awaiter(this, void 0, void 0, function* () {
                var _a;
                try {
                    if (!doc) {
                        next();
                        return;
                    }
                    const Model = this.constructor;
                    // Update query'den version bilgisini al
                    const query = this;
                    const update = query.getUpdate();
                    const newVersion = (_a = update === null || update === void 0 ? void 0 : update.$set) === null || _a === void 0 ? void 0 : _a.version;
                    if (newVersion !== undefined) {
                        doc.version = newVersion;
                    }
                    yield publishVersionEvent(doc, Model);
                    next();
                }
                catch (error) {
                    logger_service_1.logger.error('❌ [VERSION-TRACKING-HOOK-ERROR] post(findOneAndUpdate) hook error:', error);
                    next();
                }
            });
        });
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
    // Lean post hooks: .lean() ile dönen plain objelere `id` property ekler
    baseSchema.post('find', function (docs) {
        if (this.mongooseOptions().lean && Array.isArray(docs)) {
            for (const doc of docs) {
                addIdToLeanDoc(doc);
            }
        }
    });
    baseSchema.post('findOne', function (doc) {
        if (this.mongooseOptions().lean && doc) {
            addIdToLeanDoc(doc);
        }
    });
    baseSchema.post('findOneAndUpdate', function (doc) {
        if (this.mongooseOptions().lean && doc) {
            addIdToLeanDoc(doc);
        }
    });
    // Slow Query Detection — 100ms üzeri sorgular loglanır
    const SLOW_QUERY_THRESHOLD_MS = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '100', 10);
    const queryTypes = ['find', 'findOne', 'countDocuments', 'distinct'];
    for (const queryType of queryTypes) {
        baseSchema.pre(queryType, function () {
            this._startTime = Date.now();
        });
        baseSchema.post(queryType, function () {
            var _a, _b;
            if (!this._startTime)
                return;
            const duration = Date.now() - this._startTime;
            if (duration > SLOW_QUERY_THRESHOLD_MS) {
                const modelName = ((_a = this.model) === null || _a === void 0 ? void 0 : _a.modelName) || 'Unknown';
                const filter = JSON.stringify(((_b = this.getQuery) === null || _b === void 0 ? void 0 : _b.call(this)) || {}).substring(0, 200);
                logger_service_1.logger.warn(`🐢 Slow query detected: ${modelName}.${queryType} — ${duration}ms`, {
                    model: modelName,
                    operation: queryType,
                    duration,
                    filter,
                    service: process.env.SERVICE_NAME || 'unknown'
                });
            }
        });
    }
    baseSchema.methods.destroy = function () {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const instance = this;
                const Model = instance.constructor;
                // findByIdAndUpdate ile versiyon kontrolünü bypass ederek güncelleme yapar
                yield Model.findByIdAndUpdate(instance.id, {
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
        });
    };
    // ... Diğer middleware'ler aynı şekilde eklenecek
    return baseSchema;
}
exports.default = createBaseSchema;
