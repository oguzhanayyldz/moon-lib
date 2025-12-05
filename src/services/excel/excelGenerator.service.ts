import * as ExcelJS from 'exceljs';

export interface ExcelValidation {
  type: 'list' | 'custom';
  formulae?: string[];  // For list: ['item1', 'item2'] or custom formula
  allowBlank?: boolean;
  showErrorMessage?: boolean;
  errorTitle?: string;
  error?: string;
  showInputMessage?: boolean;
  promptTitle?: string;
  prompt?: string;
}

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  style?: Partial<ExcelJS.Style>;
  validation?: ExcelValidation;
  hidden?: boolean;  // For ID columns
  readOnly?: boolean;  // For read-only columns (price, stock, images, etc.)
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

export class ExcelGeneratorService {
  /**
   * Generate Excel file from data array
   */
  static async generateWorkbook(
    data: any[],
    columns: ExcelColumn[],
    options: ExcelGeneratorOptions = {}
  ): Promise<Buffer> {
    const {
      worksheetName = 'Data',
      applyHeaderStyle = true,
      freezeHeader = true
    } = options;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Moon Project';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(worksheetName);

    // Set columns
    worksheet.columns = columns.map(col => ({
      header: col.header,
      key: col.key,
      width: col.width || 15,
      style: col.style
    }));

    // Add rows
    worksheet.addRows(data);

    // Apply header styling
    if (applyHeaderStyle) {
      const headerRow = worksheet.getRow(1);
      headerRow.font = {
        bold: true,
        size: 14,  // Daha büyük ve okunaklı
        color: { argb: 'FFFFFFFF' }  // Beyaz yazı
      };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }  // Excel default mavi (profesyonel)
      };
      headerRow.alignment = {
        vertical: 'middle',
        horizontal: 'center'
      };
      headerRow.height = 30;  // Header yüksekliği artırıldı

      // Kenarlıklar ekle (profesyonel görünüm)
      headerRow.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'medium', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    }

    // Freeze header row
    if (freezeHeader) {
      worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    }

    return await workbook.xlsx.writeBuffer() as unknown as Buffer;
  }

  /**
   * Generate template Excel (only headers, optional example rows)
   */
  static async generateTemplate(
    columns: ExcelColumn[],
    exampleRows?: any[]
  ): Promise<Buffer> {
    return this.generateWorkbook(exampleRows || [], columns, {
      worksheetName: 'Template',
      applyHeaderStyle: true
    });
  }

  /**
   * Generate Excel file with multiple sheets
   */
  static async generateMultiSheet(sheets: SheetData[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Moon Project';
    workbook.created = new Date();

    for (const sheetData of sheets) {
      const {
        name,
        data,
        columns,
        options = {}
      } = sheetData;

      const {
        applyHeaderStyle = true,
        freezeHeader = true
      } = options;

      const worksheet = workbook.addWorksheet(name);

      // Set columns
      worksheet.columns = columns.map(col => ({
        header: col.header,
        key: col.key,
        width: col.width || 15,
        style: col.style,
        hidden: col.hidden || false
      }));

      // Add rows
      worksheet.addRows(data);

      // Apply column validations (dropdown lists) and read-only protection
      columns.forEach((col, colIndex) => {
        const columnLetter = String.fromCharCode(65 + colIndex); // A, B, C, ...
        const startRow = 2; // Data starts at row 2 (row 1 is header)
        const endRow = data.length + 1; // Last data row

        // Apply to all data cells in this column (including future rows)
        for (let row = startRow; row <= endRow + 1000; row++) { // +1000 for future rows
          const cell = worksheet.getCell(`${columnLetter}${row}`);

          // Apply validation if exists
          if (col.validation) {
            cell.dataValidation = {
              type: col.validation.type,
              allowBlank: col.validation.allowBlank !== false,
              formulae: col.validation.formulae || [],
              showErrorMessage: col.validation.showErrorMessage !== false,
              errorTitle: col.validation.errorTitle || 'Invalid Value',
              error: col.validation.error || 'Please select a value from the list',
              showInputMessage: col.validation.showInputMessage || false,
              promptTitle: col.validation.promptTitle || undefined,
              prompt: col.validation.prompt || undefined
            };
          }

          // Apply read-only protection if specified
          if (col.readOnly) {
            // Cell protection (locked)
            cell.protection = { locked: true };

            // Gray background as visual hint
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF0F0F0' }  // Light gray
            };
          } else {
            // Explicitly unlock editable cells
            cell.protection = { locked: false };
          }
        }
      });

      // Worksheet protection (only locked cells are protected)
      worksheet.protect('', {
        selectLockedCells: true,
        selectUnlockedCells: true,
        formatCells: false,
        formatColumns: false,
        formatRows: false,
        insertRows: false,
        deleteRows: false,
        sort: false,
        autoFilter: false
      });

      // Apply header styling
      if (applyHeaderStyle) {
        const headerRow = worksheet.getRow(1);
        headerRow.font = {
          bold: true,
          size: 14,  // Daha büyük ve okunaklı
          color: { argb: 'FFFFFFFF' }  // Beyaz yazı
        };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4472C4' }  // Excel default mavi (profesyonel)
        };
        headerRow.alignment = {
          vertical: 'middle',
          horizontal: 'center'
        };
        headerRow.height = 30;  // Header yüksekliği artırıldı

        // Kenarlıklar ekle (profesyonel görünüm)
        headerRow.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'medium', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
      }

      // Freeze header row
      if (freezeHeader) {
        worksheet.views = [{ state: 'frozen', ySplit: 1 }];
      }
    }

    return await workbook.xlsx.writeBuffer() as unknown as Buffer;
  }

  /**
   * Generate multi-sheet template Excel
   */
  static async generateMultiSheetTemplate(
    templates: { name: string; columns: ExcelColumn[]; exampleRows?: any[] }[]
  ): Promise<Buffer> {
    const sheets: SheetData[] = templates.map(template => ({
      name: template.name,
      data: template.exampleRows || [],
      columns: template.columns,
      options: {
        applyHeaderStyle: true,
        freezeHeader: true
      }
    }));

    return this.generateMultiSheet(sheets);
  }
}
