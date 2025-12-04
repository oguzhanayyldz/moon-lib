import * as ExcelJS from 'exceljs';
export interface ExcelColumn {
    header: string;
    key: string;
    width?: number;
    style?: Partial<ExcelJS.Style>;
}
export interface ExcelGeneratorOptions {
    worksheetName?: string;
    applyHeaderStyle?: boolean;
    freezeHeader?: boolean;
}
export interface SheetData {
    name: string;
    data: any[];
    columns: ExcelColumn[];
    options?: {
        applyHeaderStyle?: boolean;
        freezeHeader?: boolean;
    };
}
export declare class ExcelGeneratorService {
    /**
     * Generate Excel file from data array
     */
    static generateWorkbook(data: any[], columns: ExcelColumn[], options?: ExcelGeneratorOptions): Promise<Buffer>;
    /**
     * Generate template Excel (only headers, optional example rows)
     */
    static generateTemplate(columns: ExcelColumn[], exampleRows?: any[]): Promise<Buffer>;
    /**
     * Generate Excel file with multiple sheets
     */
    static generateMultiSheet(sheets: SheetData[]): Promise<Buffer>;
    /**
     * Generate multi-sheet template Excel
     */
    static generateMultiSheetTemplate(templates: {
        name: string;
        columns: ExcelColumn[];
        exampleRows?: any[];
    }[]): Promise<Buffer>;
}
