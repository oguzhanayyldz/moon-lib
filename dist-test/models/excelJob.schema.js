"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExcelJobStatus = exports.ExcelJobType = void 0;
exports.createExcelJobModel = createExcelJobModel;
const mongoose_1 = __importDefault(require("mongoose"));
const base_schema_1 = require("./base/base.schema");
var ExcelJobType;
(function (ExcelJobType) {
    ExcelJobType["EXPORT"] = "export";
    ExcelJobType["IMPORT"] = "import";
})(ExcelJobType || (exports.ExcelJobType = ExcelJobType = {}));
var ExcelJobStatus;
(function (ExcelJobStatus) {
    ExcelJobStatus["PENDING"] = "pending";
    ExcelJobStatus["PROCESSING"] = "processing";
    ExcelJobStatus["COMPLETED"] = "completed";
    ExcelJobStatus["FAILED"] = "failed";
})(ExcelJobStatus || (exports.ExcelJobStatus = ExcelJobStatus = {}));
// Schema definition
const excelJobSchemaDefinition = {
    user: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    parentUser: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    serviceName: {
        type: String,
        required: true,
        index: true,
        enum: ['products', 'orders', 'inventory', 'catalog', 'pricing']
    },
    entityType: {
        type: String,
        index: true,
        enum: ['product', 'category', 'brand', 'order', 'stock', 'mapping', 'catalog', 'price', 'attributes']
    },
    type: {
        type: String,
        enum: Object.values(ExcelJobType),
        required: true
    },
    status: {
        type: String,
        enum: Object.values(ExcelJobStatus),
        default: ExcelJobStatus.PENDING,
        index: true
    },
    progress: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    filters: {
        type: mongoose_1.default.Schema.Types.Mixed
    },
    fileName: {
        type: String
    },
    fileUrl: {
        type: String
    },
    totalRows: {
        type: Number
    },
    processedRows: {
        type: Number,
        default: 0
    },
    successfulRows: {
        type: Number,
        default: 0
    },
    failedRows: [{
            row: { type: Number },
            error: { type: String },
            data: { type: mongoose_1.default.Schema.Types.Mixed }
        }],
    errorMessage: {
        type: String
    },
    expiresAt: {
        type: Date,
        index: true
    }
};
const excelJobSchema = (0, base_schema_1.createBaseSchema)(excelJobSchemaDefinition);
// Compound indexes for optimal query performance
excelJobSchema.index({ user: 1, serviceName: 1, entityType: 1, createdAt: -1 });
excelJobSchema.index({ parentUser: 1, serviceName: 1, entityType: 1, createdAt: -1 });
excelJobSchema.index({ serviceName: 1, entityType: 1, status: 1, createdAt: -1 });
excelJobSchema.index({ expiresAt: 1 }); // For cleanup jobs
function createExcelJobModel(connection) {
    try {
        return connection.model('ExcelJob');
    }
    catch (_a) {
        return connection.model('ExcelJob', excelJobSchema);
    }
}
//# sourceMappingURL=excelJob.schema.js.map