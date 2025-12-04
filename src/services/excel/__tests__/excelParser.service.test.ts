import { ExcelParserService } from '../excelParser.service';
import { ExcelGeneratorService } from '../excelGenerator.service';

describe('ExcelParserService', () => {
  it('should parse excel workbook and return rows', async () => {
    // Generate test Excel file
    const data = [
      { sku: 'PROD-001', name: 'Product 1', price: 100 },
      { sku: 'PROD-002', name: 'Product 2', price: 200 }
    ];

    const columns = [
      { header: 'SKU', key: 'sku' },
      { header: 'Name', key: 'name' },
      { header: 'Price', key: 'price' }
    ];

    const buffer = await ExcelGeneratorService.generateWorkbook(data, columns);

    // Parse it
    const rows = await ExcelParserService.parseWorkbook(buffer);

    expect(rows).toHaveLength(2);
    expect(rows[0].rowNumber).toBe(2); // Row 1 is header
    expect(rows[0].data['SKU']).toBe('PROD-001');
    expect(rows[0].data['Name']).toBe('Product 1');
    expect(rows[0].data['Price']).toBe(100);

    expect(rows[1].rowNumber).toBe(3);
    expect(rows[1].data['SKU']).toBe('PROD-002');
  });

  it('should skip empty rows by default', async () => {
    const data = [
      { sku: 'PROD-001', name: 'Product 1' },
      { sku: '', name: '' }, // Empty row
      { sku: 'PROD-003', name: 'Product 3' }
    ];

    const columns = [
      { header: 'SKU', key: 'sku' },
      { header: 'Name', key: 'name' }
    ];

    const buffer = await ExcelGeneratorService.generateWorkbook(data, columns);
    const rows = await ExcelParserService.parseWorkbook(buffer);

    // Should skip empty row
    expect(rows).toHaveLength(2);
    expect(rows[0].data['SKU']).toBe('PROD-001');
    expect(rows[1].data['SKU']).toBe('PROD-003');
  });

  it('should trim string values by default', async () => {
    const data = [
      { name: '  Product with spaces  ' }
    ];

    const columns = [
      { header: 'Name', key: 'name' }
    ];

    const buffer = await ExcelGeneratorService.generateWorkbook(data, columns);
    const rows = await ExcelParserService.parseWorkbook(buffer);

    expect(rows[0].data['Name']).toBe('Product with spaces');
  });

  it('should validate excel structure - valid', async () => {
    const data = [{ sku: 'TEST', name: 'Test', price: 100 }];
    const columns = [
      { header: 'SKU', key: 'sku' },
      { header: 'Name', key: 'name' },
      { header: 'Price', key: 'price' }
    ];

    const buffer = await ExcelGeneratorService.generateWorkbook(data, columns);

    const requiredColumns = ['SKU', 'Name', 'Price'];
    const validation = await ExcelParserService.validateStructure(buffer, requiredColumns);

    expect(validation.valid).toBe(true);
    expect(validation.missingColumns).toHaveLength(0);
  });

  it('should validate excel structure - invalid (missing columns)', async () => {
    const data = [{ sku: 'TEST', name: 'Test' }];
    const columns = [
      { header: 'SKU', key: 'sku' },
      { header: 'Name', key: 'name' }
    ];

    const buffer = await ExcelGeneratorService.generateWorkbook(data, columns);

    const requiredColumns = ['SKU', 'Name', 'Price', 'Tax'];
    const validation = await ExcelParserService.validateStructure(buffer, requiredColumns);

    expect(validation.valid).toBe(false);
    expect(validation.missingColumns).toEqual(['Price', 'Tax']);
  });

  it('should throw error if Excel has no worksheets', async () => {
    const emptyBuffer = Buffer.from([]);

    await expect(
      ExcelParserService.parseWorkbook(emptyBuffer)
    ).rejects.toThrow();
  });

  describe('Multi-Sheet Support', () => {
    it('should get all sheet names', async () => {
      const sheets = [
        {
          name: 'Products',
          data: [{ sku: 'P1', name: 'Product 1' }],
          columns: [
            { header: 'SKU', key: 'sku' },
            { header: 'Name', key: 'name' }
          ]
        },
        {
          name: 'Combinations',
          data: [{ size: 'M', color: 'Red' }],
          columns: [
            { header: 'Size', key: 'size' },
            { header: 'Color', key: 'color' }
          ]
        }
      ];

      const buffer = await ExcelGeneratorService.generateMultiSheet(sheets);
      const sheetNames = await ExcelParserService.getSheetNames(buffer);

      expect(sheetNames).toHaveLength(2);
      expect(sheetNames).toContain('Products');
      expect(sheetNames).toContain('Combinations');
    });

    it('should parse sheet by name', async () => {
      const sheets = [
        {
          name: 'Products',
          data: [
            { sku: 'P1', name: 'Product 1' },
            { sku: 'P2', name: 'Product 2' }
          ],
          columns: [
            { header: 'SKU', key: 'sku' },
            { header: 'Name', key: 'name' }
          ]
        },
        {
          name: 'Prices',
          data: [{ sku: 'P1', price: 100 }],
          columns: [
            { header: 'SKU', key: 'sku' },
            { header: 'Price', key: 'price' }
          ]
        }
      ];

      const buffer = await ExcelGeneratorService.generateMultiSheet(sheets);
      const productsSheet = await ExcelParserService.parseSheetByName(buffer, 'Products');

      expect(productsSheet.sheetName).toBe('Products');
      expect(productsSheet.sheetIndex).toBe(0);
      expect(productsSheet.rows).toHaveLength(2);
      expect(productsSheet.headers).toEqual(['SKU', 'Name']);
      expect(productsSheet.rows[0].data['SKU']).toBe('P1');
      expect(productsSheet.rows[1].data['SKU']).toBe('P2');
    });

    it('should throw error when sheet name not found', async () => {
      const sheets = [
        {
          name: 'Products',
          data: [{ sku: 'P1' }],
          columns: [{ header: 'SKU', key: 'sku' }]
        }
      ];

      const buffer = await ExcelGeneratorService.generateMultiSheet(sheets);

      await expect(
        ExcelParserService.parseSheetByName(buffer, 'NonExistent')
      ).rejects.toThrow('Sheet "NonExistent" not found');
    });

    it('should parse sheet by index', async () => {
      const sheets = [
        {
          name: 'Sheet1',
          data: [{ a: 1 }],
          columns: [{ header: 'A', key: 'a' }]
        },
        {
          name: 'Sheet2',
          data: [{ b: 2 }],
          columns: [{ header: 'B', key: 'b' }]
        }
      ];

      const buffer = await ExcelGeneratorService.generateMultiSheet(sheets);
      const sheet = await ExcelParserService.parseSheetByIndex(buffer, 1);

      expect(sheet.sheetName).toBe('Sheet2');
      expect(sheet.sheetIndex).toBe(1);
      expect(sheet.rows[0].data['B']).toBe(2);
    });

    it('should parse all sheets', async () => {
      const sheets = [
        {
          name: 'Products',
          data: [{ sku: 'P1' }],
          columns: [{ header: 'SKU', key: 'sku' }]
        },
        {
          name: 'Stock',
          data: [{ qty: 10 }],
          columns: [{ header: 'Qty', key: 'qty' }]
        },
        {
          name: 'Prices',
          data: [{ price: 100 }],
          columns: [{ header: 'Price', key: 'price' }]
        }
      ];

      const buffer = await ExcelGeneratorService.generateMultiSheet(sheets);
      const allSheets = await ExcelParserService.parseAllSheets(buffer);

      expect(allSheets).toHaveLength(3);
      expect(allSheets[0].sheetName).toBe('Products');
      expect(allSheets[1].sheetName).toBe('Stock');
      expect(allSheets[2].sheetName).toBe('Prices');
    });

    it('should parse specific sheets by names', async () => {
      const sheets = [
        {
          name: 'Products',
          data: [{ sku: 'P1' }],
          columns: [{ header: 'SKU', key: 'sku' }]
        },
        {
          name: 'Stock',
          data: [{ qty: 10 }],
          columns: [{ header: 'Qty', key: 'qty' }]
        },
        {
          name: 'Prices',
          data: [{ price: 100 }],
          columns: [{ header: 'Price', key: 'price' }]
        }
      ];

      const buffer = await ExcelGeneratorService.generateMultiSheet(sheets);
      const specificSheets = await ExcelParserService.parseSpecificSheets(
        buffer,
        ['Products', 'Prices']
      );

      expect(specificSheets).toHaveLength(2);
      expect(specificSheets[0].sheetName).toBe('Products');
      expect(specificSheets[1].sheetName).toBe('Prices');
    });

    it('should validate multi-sheet structure - valid', async () => {
      const sheets = [
        {
          name: 'Products',
          data: [{ sku: 'P1', name: 'Test', price: 100 }],
          columns: [
            { header: 'SKU', key: 'sku' },
            { header: 'Name', key: 'name' },
            { header: 'Price', key: 'price' }
          ]
        },
        {
          name: 'Stock',
          data: [{ sku: 'P1', qty: 10 }],
          columns: [
            { header: 'SKU', key: 'sku' },
            { header: 'Qty', key: 'qty' }
          ]
        }
      ];

      const buffer = await ExcelGeneratorService.generateMultiSheet(sheets);

      const validation = await ExcelParserService.validateMultiSheetStructure(
        buffer,
        {
          'Products': ['SKU', 'Name', 'Price'],
          'Stock': ['SKU', 'Qty']
        }
      );

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should validate multi-sheet structure - invalid', async () => {
      const sheets = [
        {
          name: 'Products',
          data: [{ sku: 'P1', name: 'Test' }],
          columns: [
            { header: 'SKU', key: 'sku' },
            { header: 'Name', key: 'name' }
          ]
        }
      ];

      const buffer = await ExcelGeneratorService.generateMultiSheet(sheets);

      const validation = await ExcelParserService.validateMultiSheetStructure(
        buffer,
        {
          'Products': ['SKU', 'Name', 'Price', 'Tax'],
          'Stock': ['SKU', 'Qty']
        }
      );

      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(2);

      // Products sheet missing columns
      expect(validation.errors[0].sheetName).toBe('Products');
      expect(validation.errors[0].missingColumns).toEqual(['Price', 'Tax']);

      // Stock sheet not found
      expect(validation.errors[1].sheetName).toBe('Stock');
      expect(validation.errors[1].missingColumns).toEqual(['SKU', 'Qty']);
    });
  });
});
