"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Outbox = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const base_schema_1 = __importDefault(require("./base/base.schema"));
const common_1 = require("@xmoonx/common");
const OutboxSchema = new mongoose_1.default.Schema({
    eventType: { type: String, required: true },
    payload: { type: mongoose_1.default.Schema.Types.Mixed, required: true },
    status: { type: String, required: true, default: 'pending', enmum: ['pending', 'published', 'failed'] },
    retryCount: { type: Number, default: 0 },
    lastAttempt: Date
}, {
    timestamps: true
});
OutboxSchema.add(base_schema_1.default);
const Outbox = mongoose_1.default.model("Outbox", OutboxSchema);
exports.Outbox = Outbox;
