import mongoose from 'mongoose';
import { BaseAttrs, BaseDoc, BaseModel } from './base/base.schema';
export declare enum ExcelJobType {
    EXPORT = "export",
    IMPORT = "import"
}
export declare enum ExcelJobStatus {
    PENDING = "pending",
    PROCESSING = "processing",
    COMPLETED = "completed",
    FAILED = "failed"
}
export interface FailedRow {
    row: number;
    error: string;
    data?: any;
}
export interface ExcelJobAttrs extends BaseAttrs {
    user: string | mongoose.Types.ObjectId;
    parentUser?: string | mongoose.Types.ObjectId;
    serviceName: string;
    entityType?: string;
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
    entityType?: string;
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
export interface ExcelJobModel extends BaseModel<ExcelJobDoc, ExcelJobAttrs> {
}
export declare function createExcelJobModel(connection: mongoose.Connection): ExcelJobModel;
//# sourceMappingURL=excelJob.schema.d.ts.map