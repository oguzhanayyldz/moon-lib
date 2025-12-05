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
