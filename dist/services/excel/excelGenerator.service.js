"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExcelGeneratorService = void 0;
const ExcelJS = __importStar(require("exceljs"));
class ExcelGeneratorService {
    /**
     * Generate Excel file from data array
     */
    static generateWorkbook(data_1, columns_1) {
        return __awaiter(this, arguments, void 0, function* (data, columns, options = {}) {
            const { worksheetName = 'Data', applyHeaderStyle = true, freezeHeader = true } = options;
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
                    size: 14, // Daha büyük ve okunaklı
                    color: { argb: 'FFFFFFFF' } // Beyaz yazı
                };
                headerRow.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF4472C4' } // Excel default mavi (profesyonel)
                };
                headerRow.alignment = {
                    vertical: 'middle',
                    horizontal: 'center'
                };
                headerRow.height = 30; // Header yüksekliği artırıldı
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
            return yield workbook.xlsx.writeBuffer();
        });
    }
    /**
     * Generate template Excel (only headers, optional example rows)
     */
    static generateTemplate(columns, exampleRows) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.generateWorkbook(exampleRows || [], columns, {
                worksheetName: 'Template',
                applyHeaderStyle: true
            });
        });
    }
    /**
     * Generate Excel file with multiple sheets
     */
    static generateMultiSheet(sheets) {
        return __awaiter(this, void 0, void 0, function* () {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Moon Project';
            workbook.created = new Date();
            for (const sheetData of sheets) {
                const { name, data, columns, options = {} } = sheetData;
                const { applyHeaderStyle = true, freezeHeader = true } = options;
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
                        size: 14, // Daha büyük ve okunaklı
                        color: { argb: 'FFFFFFFF' } // Beyaz yazı
                    };
                    headerRow.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FF4472C4' } // Excel default mavi (profesyonel)
                    };
                    headerRow.alignment = {
                        vertical: 'middle',
                        horizontal: 'center'
                    };
                    headerRow.height = 30; // Header yüksekliği artırıldı
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
            return yield workbook.xlsx.writeBuffer();
        });
    }
    /**
     * Generate multi-sheet template Excel
     */
    static generateMultiSheetTemplate(templates) {
        return __awaiter(this, void 0, void 0, function* () {
            const sheets = templates.map(template => ({
                name: template.name,
                data: template.exampleRows || [],
                columns: template.columns,
                options: {
                    applyHeaderStyle: true,
                    freezeHeader: true
                }
            }));
            return this.generateMultiSheet(sheets);
        });
    }
}
exports.ExcelGeneratorService = ExcelGeneratorService;
