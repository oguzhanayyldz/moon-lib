import * as ExcelJS from 'exceljs';

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
  [sheetName: string]: string[]; // sheetName -> required columns
}

export class ExcelParserService {
  /**
   * Parse Excel file and return rows as objects
   */
  static async parseWorkbook(
    buffer: Buffer,
    options: ParseOptions = {}
  ): Promise<ParsedRow[]> {
    const {
      skipEmptyRows = true,
      trimValues = true
    } = options;

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('Excel file contains no worksheets');
    }

    const rows: ParsedRow[] = [];
    let headers: string[] = [];

    worksheet.eachRow((row, rowNumber) => {
      // First row is headers
      if (rowNumber === 1) {
        headers = row.values as string[];
        headers.shift(); // Remove first empty element from ExcelJS
        return;
      }

      const values = row.values as any[];
      values.shift(); // Remove first empty element

      // Skip empty rows
      if (skipEmptyRows && values.every(v => !v)) {
        return;
      }

      // Map to object
      const rowData: Record<string, any> = {};
      headers.forEach((header, index) => {
        let value = values[index];

        // Trim strings
        if (trimValues && typeof value === 'string') {
          value = value.trim();
        }

        rowData[header] = value;
      });

      rows.push({
        rowNumber,
        data: rowData
      });
    });

    return rows;
  }

  /**
   * Validate Excel file structure
   */
  static async validateStructure(
    buffer: Buffer,
    requiredColumns: string[]
  ): Promise<{ valid: boolean; missingColumns: string[] }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return { valid: false, missingColumns: requiredColumns };
    }

    const headerRow = worksheet.getRow(1);
    const headers = headerRow.values as string[];
    headers.shift();

    const missingColumns = requiredColumns.filter(
      col => !headers.includes(col)
    );

    return {
      valid: missingColumns.length === 0,
      missingColumns
    };
  }

  /**
   * Get all sheet names from Excel file
   */
  static async getSheetNames(buffer: Buffer): Promise<string[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    return workbook.worksheets.map(ws => ws.name);
  }

  /**
   * Parse specific sheet by name
   */
  static async parseSheetByName(
    buffer: Buffer,
    sheetName: string,
    options: ParseOptions = {}
  ): Promise<ParsedSheet> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.worksheets.find(ws => ws.name === sheetName);
    if (!worksheet) {
      throw new Error(`Sheet "${sheetName}" not found`);
    }

    const sheetIndex = workbook.worksheets.indexOf(worksheet);
    return this.parseWorksheet(worksheet, sheetIndex, options);
  }

  /**
   * Parse specific sheet by index
   */
  static async parseSheetByIndex(
    buffer: Buffer,
    sheetIndex: number,
    options: ParseOptions = {}
  ): Promise<ParsedSheet> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.worksheets[sheetIndex];
    if (!worksheet) {
      throw new Error(`Sheet at index ${sheetIndex} not found`);
    }

    return this.parseWorksheet(worksheet, sheetIndex, options);
  }

  /**
   * Parse all sheets in Excel file
   */
  static async parseAllSheets(
    buffer: Buffer,
    options: ParseOptions = {}
  ): Promise<ParsedSheet[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const sheets: ParsedSheet[] = [];

    for (let i = 0; i < workbook.worksheets.length; i++) {
      const worksheet = workbook.worksheets[i];
      const parsedSheet = this.parseWorksheet(worksheet, i, options);
      sheets.push(parsedSheet);
    }

    return sheets;
  }

  /**
   * Parse specific sheets by name list
   */
  static async parseSpecificSheets(
    buffer: Buffer,
    sheetNames: string[],
    options: ParseOptions = {}
  ): Promise<ParsedSheet[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const sheets: ParsedSheet[] = [];

    for (const sheetName of sheetNames) {
      const worksheet = workbook.worksheets.find(ws => ws.name === sheetName);
      if (worksheet) {
        const sheetIndex = workbook.worksheets.indexOf(worksheet);
        const parsedSheet = this.parseWorksheet(worksheet, sheetIndex, options);
        sheets.push(parsedSheet);
      }
    }

    return sheets;
  }

  /**
   * Validate multi-sheet structure
   */
  static async validateMultiSheetStructure(
    buffer: Buffer,
    validation: MultiSheetValidation
  ): Promise<{
    valid: boolean;
    errors: { sheetName: string; missingColumns: string[] }[];
  }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const errors: { sheetName: string; missingColumns: string[] }[] = [];

    for (const [sheetName, requiredColumns] of Object.entries(validation)) {
      const worksheet = workbook.worksheets.find(ws => ws.name === sheetName);

      if (!worksheet) {
        errors.push({
          sheetName,
          missingColumns: requiredColumns
        });
        continue;
      }

      const headerRow = worksheet.getRow(1);
      const headers = headerRow.values as string[];
      headers.shift();

      const missingColumns = requiredColumns.filter(
        col => !headers.includes(col)
      );

      if (missingColumns.length > 0) {
        errors.push({ sheetName, missingColumns });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Private helper: Parse single worksheet
   */
  private static parseWorksheet(
    worksheet: ExcelJS.Worksheet,
    sheetIndex: number,
    options: ParseOptions = {}
  ): ParsedSheet {
    const {
      skipEmptyRows = true,
      trimValues = true
    } = options;

    const rows: ParsedRow[] = [];
    let headers: string[] = [];

    worksheet.eachRow((row, rowNumber) => {
      // First row is headers
      if (rowNumber === 1) {
        headers = row.values as string[];
        headers.shift(); // Remove first empty element from ExcelJS
        return;
      }

      const values = row.values as any[];
      values.shift(); // Remove first empty element

      // Skip empty rows
      if (skipEmptyRows && values.every(v => !v)) {
        return;
      }

      // Map to object
      const rowData: Record<string, any> = {};
      headers.forEach((header, index) => {
        let value = values[index];

        // Trim strings
        if (trimValues && typeof value === 'string') {
          value = value.trim();
        }

        rowData[header] = value;
      });

      rows.push({
        rowNumber,
        data: rowData
      });
    });

    return {
      sheetName: worksheet.name,
      sheetIndex,
      rows,
      headers
    };
  }
}
