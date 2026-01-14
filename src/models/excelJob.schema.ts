import mongoose from 'mongoose';
import { BaseAttrs, BaseDoc, BaseModel, createBaseSchema } from './base/base.schema';

export enum ExcelJobType {
  EXPORT = 'export',
  IMPORT = 'import'
}

export enum ExcelJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface FailedRow {
  sheet: string;
  row: number;
  error: string;
  data?: any;
}

export interface ExcelJobAttrs extends BaseAttrs {
  user: string | mongoose.Types.ObjectId;
  parentUser?: string | mongoose.Types.ObjectId;
  serviceName: string;
  entityType?: string; // 'product', 'category', 'brand', etc.
  type: ExcelJobType;
  status?: ExcelJobStatus;
  progress?: number;
  filters?: Record<string, any>;
  fileName?: string;
  fileUrl?: string;
  totalRows?: number;
  processedRows?: number;
  successfulRows?: number;
  failedRows?: FailedRow[];
  errorMessage?: string;
  expiresAt?: Date;
}

export interface ExcelJobDoc extends BaseDoc {
  user: mongoose.Types.ObjectId;
  parentUser?: mongoose.Types.ObjectId;
  serviceName: string;
  entityType?: string; // 'product', 'category', 'brand', etc.
  type: ExcelJobType;
  status: ExcelJobStatus;
  progress: number;
  filters?: Record<string, any>;
  fileName?: string;
  fileUrl?: string;
  totalRows?: number;
  processedRows: number;
  successfulRows: number;
  failedRows: FailedRow[];
  errorMessage?: string;
  expiresAt?: Date;
}

export interface ExcelJobModel extends BaseModel<ExcelJobDoc, ExcelJobAttrs> {}

// Schema definition
const excelJobSchemaDefinition = {
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  parentUser: {
    type: mongoose.Schema.Types.ObjectId,
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
    enum: ['product', 'category', 'brand', 'order', 'stock', 'mapping', 'catalog', 'price', 'attributes', 'category-mapping', 'brand-mapping', 'system-prices', 'catalog-prices']
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
    type: mongoose.Schema.Types.Mixed
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
    sheet: { type: String },
    row: { type: Number },
    error: { type: String },
    data: { type: mongoose.Schema.Types.Mixed }
  }],
  errorMessage: {
    type: String
  },
  expiresAt: {
    type: Date,
    index: true
  }
};

const excelJobSchema = createBaseSchema(excelJobSchemaDefinition);

// Compound indexes for optimal query performance
excelJobSchema.index({ user: 1, serviceName: 1, entityType: 1, createdAt: -1 });
excelJobSchema.index({ parentUser: 1, serviceName: 1, entityType: 1, createdAt: -1 });
excelJobSchema.index({ serviceName: 1, entityType: 1, status: 1, createdAt: -1 });
excelJobSchema.index({ expiresAt: 1 }); // For cleanup jobs

export function createExcelJobModel(connection: mongoose.Connection) {
  try {
    return connection.model<ExcelJobDoc, ExcelJobModel>('ExcelJob');
  } catch {
    return connection.model<ExcelJobDoc, ExcelJobModel>('ExcelJob', excelJobSchema);
  }
}
