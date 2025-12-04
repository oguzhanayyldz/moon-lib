export interface ParsedRow {
    rowNumber: number;
    data: Record<string, any>;
}
export interface ParsedSheet {
    sheetName: string;
    sheetIndex: number;
    rows: ParsedRow[];
    headers: string[];
}
export interface ParseOptions {
    skipEmptyRows?: boolean;
    trimValues?: boolean;
}
export interface MultiSheetValidation {
    [sheetName: string]: string[];
}
export declare class ExcelParserService {
    /**
     * Parse Excel file and return rows as objects
     */
    static parseWorkbook(buffer: Buffer, options?: ParseOptions): Promise<ParsedRow[]>;
    /**
     * Validate Excel file structure
     */
    static validateStructure(buffer: Buffer, requiredColumns: string[]): Promise<{
        valid: boolean;
        missingColumns: string[];
    }>;
    /**
     * Get all sheet names from Excel file
     */
    static getSheetNames(buffer: Buffer): Promise<string[]>;
    /**
     * Parse specific sheet by name
     */
    static parseSheetByName(buffer: Buffer, sheetName: string, options?: ParseOptions): Promise<ParsedSheet>;
    /**
     * Parse specific sheet by index
     */
    static parseSheetByIndex(buffer: Buffer, sheetIndex: number, options?: ParseOptions): Promise<ParsedSheet>;
    /**
     * Parse all sheets in Excel file
     */
    static parseAllSheets(buffer: Buffer, options?: ParseOptions): Promise<ParsedSheet[]>;
    /**
     * Parse specific sheets by name list
     */
    static parseSpecificSheets(buffer: Buffer, sheetNames: string[], options?: ParseOptions): Promise<ParsedSheet[]>;
    /**
     * Validate multi-sheet structure
     */
    static validateMultiSheetStructure(buffer: Buffer, validation: MultiSheetValidation): Promise<{
        valid: boolean;
        errors: {
            sheetName: string;
            missingColumns: string[];
        }[];
    }>;
    /**
     * Private helper: Parse single worksheet
     */
    private static parseWorksheet;
}
