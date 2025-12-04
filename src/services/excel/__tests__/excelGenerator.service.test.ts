import { ExcelGeneratorService } from '../excelGenerator.service';
import * as ExcelJS from 'exceljs';

describe('ExcelGeneratorService', () => {
  it('should generate excel workbook with data', async () => {
    const data = [
      { name: 'Product 1', price: 100 },
      { name: 'Product 2', price: 200 }
    ];

    const columns = [
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Price', key: 'price', width: 10 }
    ];

    const buffer = await ExcelGeneratorService.generateWorkbook(data, columns);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // Verify content
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.worksheets[0];
    expect(worksheet.getRow(2).getCell(1).value).toBe('Product 1');
    expect(worksheet.getRow(2).getCell(2).value).toBe(100);
    expect(worksheet.getRow(3).getCell(1).value).toBe('Product 2');
    expect(worksheet.getRow(3).getCell(2).value).toBe(200);
  });

  it('should generate template without data', async () => {
    const columns = [
      { header: 'SKU', key: 'sku' },
      { header: 'Name', key: 'name' }
    ];

    const buffer = await ExcelGeneratorService.generateTemplate(columns);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.worksheets[0];
    expect(worksheet.rowCount).toBe(1); // Only header
    expect(worksheet.getRow(1).getCell(1).value).toBe('SKU');
    expect(worksheet.getRow(1).getCell(2).value).toBe('Name');
  });

  it('should generate template with example rows', async () => {
    const columns = [
      { header: 'SKU', key: 'sku' },
      { header: 'Name', key: 'name' }
    ];

    const exampleRow = {
      sku: 'EXAMPLE-001',
      name: 'Example Product'
    };

    const buffer = await ExcelGeneratorService.generateTemplate(columns, [exampleRow]);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.worksheets[0];
    expect(worksheet.rowCount).toBe(2); // Header + 1 example row
    expect(worksheet.getRow(2).getCell(1).value).toBe('EXAMPLE-001');
  });

  it('should apply header styling by default', async () => {
    const data = [{ name: 'Test' }];
    const columns = [{ header: 'Name', key: 'name' }];

    const buffer = await ExcelGeneratorService.generateWorkbook(data, columns);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.worksheets[0];
    const headerRow = worksheet.getRow(1);

    expect(headerRow.font?.bold).toBe(true);
  });

  it('should freeze header row by default', async () => {
    const data = [{ name: 'Test' }];
    const columns = [{ header: 'Name', key: 'name' }];

    const buffer = await ExcelGeneratorService.generateWorkbook(data, columns);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.worksheets[0];

    expect(worksheet.views).toBeDefined();
    expect(worksheet.views![0].state).toBe('frozen');
    expect((worksheet.views![0] as any).ySplit).toBe(1);
  });
});
