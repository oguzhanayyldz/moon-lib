"use strict";
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
const mongoose_1 = __importDefault(require("mongoose"));
const mongoose_update_if_current_1 = require("mongoose-update-if-current");
const uuid_1 = require("uuid");
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const common_1 = require("@xmoonx/common");
const BaseSchema = new mongoose_1.default.Schema({
    uuid: {
        type: String,
    },
    creationDate: {
        type: Date,
        default: Date.now,
        required: true,
        timezone: 'Europe/Istanbul',
        get: (val) => (0, moment_timezone_1.default)(val).tz('Europe/Istanbul').format()
    },
    updatedOn: {
        type: Date,
        default: Date.now,
        required: true,
        timezone: 'Europe/Istanbul',
        get: (val) => (0, moment_timezone_1.default)(val).tz('Europe/Istanbul').format()
    },
    deletionDate: {
        type: Date,
        timezone: 'Europe/Istanbul',
        get: (val) => val ? (0, moment_timezone_1.default)(val).tz('Europe/Istanbul').format() : undefined
    },
    deleted: {
        type: Boolean,
    },
    uniqueCode: {
        type: String,
        unique: true
    }
}, {
    toJSON: {
        transform(doc, ret) {
            ret.id = ret._id;
            delete ret._id;
            delete ret.__v;
        }
    }
});
BaseSchema.set('versionKey', 'version');
BaseSchema.plugin(mongoose_update_if_current_1.updateIfCurrentPlugin);
BaseSchema.set('toJSON', { getters: true });
BaseSchema.set('toObject', { getters: true });
BaseSchema.statics.build = (attrs, modelName) => {
    const Model = mongoose_1.default.model(modelName);
    if (attrs && attrs.id) {
        attrs._id = attrs.id;
        delete attrs.id;
    }
    return new Model(attrs);
};
BaseSchema.statics.findByCustom = (id, modelName) => {
    const Model = mongoose_1.default.model(modelName);
    return Model.findById(id)
        .where({ deletionDate: { $exists: false }, deleted: { $exists: false } })
        .exec();
};
BaseSchema.statics.findByEvent = (event, modelName) => {
    const Model = mongoose_1.default.model(modelName);
    return Model.findOne({
        _id: event.id,
        version: event.version - 1,
        deletionDate: { $exists: false },
        deleted: { $exists: false }
    });
};
BaseSchema.statics.filter = (where, modelName, limit, offset, order) => {
    const Model = mongoose_1.default.model(modelName);
    limit = limit || 20;
    offset = offset || 0;
    const query = Model.find()
        .where(where)
        .sort(order)
        .skip(offset)
        .limit(limit);
    return query.exec();
};
BaseSchema.statics.destroyMany = function (where, modelName) {
    return __awaiter(this, void 0, void 0, function* () {
        const Model = mongoose_1.default.model(modelName);
        const updateResult = yield Model.updateMany(where, {
            $set: {
                deletionDate: new Date(),
                uniqueCode: new Date().getTime().toString() + "-" + (0, common_1.generateRandomString)(4),
                deleted: true
            }
        });
        return {
            matchedCount: updateResult.matchedCount,
            modifiedCount: updateResult.modifiedCount
        };
    });
};
BaseSchema.pre("save", function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!this.uuid) {
            this.uuid = (0, uuid_1.v4)();
        }
        if (!this.deleted && !this.deletionDate && !this.uniqueCode)
            this.uniqueCode = new Date().getTime().toString() + "-" + (0, common_1.generateRandomString)(6);
        this.updatedOn = new Date();
        next();
    });
});
BaseSchema.pre('findOneAndUpdate', function (next) {
    const filter = this.getQuery();
    this.updateOne(filter, { $set: { updatedOn: new Date() } });
    next();
});
BaseSchema.pre('updateOne', function (next) {
    const filter = this.getQuery();
    this.updateOne(filter, { $set: { updatedOn: new Date() } });
    next();
});
BaseSchema.pre('find', function (next) {
    const query = this;
    const queryConditions = query.getQuery();
    const includeDeleted = queryConditions.includeDeleted;
    delete queryConditions.includeDeleted;
    if (!includeDeleted) {
        query.where({ deletionDate: { $exists: false }, deleted: { $exists: false } });
    }
    next();
});
BaseSchema.pre('findOne', function (next) {
    const query = this;
    const queryConditions = query.getQuery();
    const includeDeleted = queryConditions.includeDeleted;
    delete queryConditions.includeDeleted;
    if (!includeDeleted) {
        query.where({ deletionDate: { $exists: false }, deleted: { $exists: false } });
    }
    next();
});
BaseSchema.methods.destroy = function () {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const instance = this;
            if (!instance.deletionDate) {
                instance.deletionDate = new Date();
            }
            instance.uniqueCode = new Date().getTime().toString() + "-" + (0, common_1.generateRandomString)(6);
            instance.deleted = true;
            yield instance.save();
        }
        catch (err) {
            console.error(err);
        }
    });
};
exports.default = BaseSchema;
