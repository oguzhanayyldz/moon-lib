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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBaseSchema = createBaseSchema;
const mongoose_1 = __importStar(require("mongoose"));
const mongoose_update_if_current_1 = require("mongoose-update-if-current");
const uuid_1 = require("uuid");
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const common_1 = require("@xmoonx/common");
function createBaseSchema(schemaDefinition = {}) {
    const baseSchema = new mongoose_1.Schema(Object.assign({ uuid: { type: String }, creationDate: {
            type: Date,
            default: Date.now,
            required: true,
            timezone: 'Europe/Istanbul',
            get: (val) => (0, moment_timezone_1.default)(val).tz('Europe/Istanbul').format()
        }, updatedOn: {
            type: Date,
            default: Date.now,
            required: true,
            timezone: 'Europe/Istanbul',
            get: (val) => (0, moment_timezone_1.default)(val).tz('Europe/Istanbul').format()
        }, deletionDate: {
            type: Date,
            timezone: 'Europe/Istanbul',
            get: (val) => val ? (0, moment_timezone_1.default)(val).tz('Europe/Istanbul').format() : undefined
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
                // Her kayıt için ayrı ayrı sil
                for (const docId of docIds) {
                    const doc = yield this.findById(docId);
                    if (doc) {
                        doc.deletionDate = new Date();
                        doc.uniqueCode = `deleted-${(0, uuid_1.v4)()}`; // Her kayıt için benzersiz bir değer oluştur
                        doc.deleted = true;
                        yield doc.save();
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
    baseSchema.methods.destroy = function () {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const instance = this;
                if (!instance.deletionDate) {
                    instance.deletionDate = new Date();
                }
                instance.uniqueCode = `deleted-${(0, uuid_1.v4)()}`; // Benzersiz değer için UUID kullan
                instance.deleted = true;
                yield instance.save();
                // İşlem bilgisini ek veri olarak döndür (servisin erişebileceği)
                const constructor = instance.constructor;
                const entityType = constructor.collection ? constructor.collection.name.replace(/s$/, '') : '';
                // Bir event nesnesi döndür, bunu servis katmanı işleyecek
                return {
                    id: instance.id,
                    entity: entityType,
                    timestamp: new Date().toISOString()
                };
            }
            catch (err) {
                console.error(err);
                return undefined; // Ensure a return value in case of an error
            }
        });
    };
    // ... Diğer middleware'ler aynı şekilde eklenecek
    return baseSchema;
}
exports.default = createBaseSchema;
