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
exports.ExcelParserService = void 0;
const ExcelJS = __importStar(require("exceljs"));
class ExcelParserService {
    /**
     * Parse Excel file and return rows as objects
     */
    static parseWorkbook(buffer_1) {
        return __awaiter(this, arguments, void 0, function* (buffer, options = {}) {
            const { skipEmptyRows = true, trimValues = true } = options;
            const workbook = new ExcelJS.Workbook();
            yield workbook.xlsx.load(buffer);
            const worksheet = workbook.worksheets[0];
            if (!worksheet) {
                throw new Error('Excel file contains no worksheets');
            }
            const rows = [];
            let headers = [];
            worksheet.eachRow((row, rowNumber) => {
                // First row is headers
                if (rowNumber === 1) {
                    headers = row.values;
                    headers.shift(); // Remove first empty element from ExcelJS
                    return;
                }
                const values = row.values;
                values.shift(); // Remove first empty element
                // Skip empty rows
                if (skipEmptyRows && values.every(v => !v)) {
                    return;
                }
                // Map to object
                const rowData = {};
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
        });
    }
    /**
     * Validate Excel file structure
     */
    static validateStructure(buffer, requiredColumns) {
        return __awaiter(this, void 0, void 0, function* () {
            const workbook = new ExcelJS.Workbook();
            yield workbook.xlsx.load(buffer);
            const worksheet = workbook.worksheets[0];
            if (!worksheet) {
                return { valid: false, missingColumns: requiredColumns };
            }
            const headerRow = worksheet.getRow(1);
            const headers = headerRow.values;
            headers.shift();
            const missingColumns = requiredColumns.filter(col => !headers.includes(col));
            return {
                valid: missingColumns.length === 0,
                missingColumns
            };
        });
    }
    /**
     * Get all sheet names from Excel file
     */
    static getSheetNames(buffer) {
        return __awaiter(this, void 0, void 0, function* () {
            const workbook = new ExcelJS.Workbook();
            yield workbook.xlsx.load(buffer);
            return workbook.worksheets.map(ws => ws.name);
        });
    }
    /**
     * Parse specific sheet by name
     */
    static parseSheetByName(buffer_1, sheetName_1) {
        return __awaiter(this, arguments, void 0, function* (buffer, sheetName, options = {}) {
            const workbook = new ExcelJS.Workbook();
            yield workbook.xlsx.load(buffer);
            const worksheet = workbook.worksheets.find(ws => ws.name === sheetName);
            if (!worksheet) {
                throw new Error(`Sheet "${sheetName}" not found`);
            }
            const sheetIndex = workbook.worksheets.indexOf(worksheet);
            return this.parseWorksheet(worksheet, sheetIndex, options);
        });
    }
    /**
     * Parse specific sheet by index
     */
    static parseSheetByIndex(buffer_1, sheetIndex_1) {
        return __awaiter(this, arguments, void 0, function* (buffer, sheetIndex, options = {}) {
            const workbook = new ExcelJS.Workbook();
            yield workbook.xlsx.load(buffer);
            const worksheet = workbook.worksheets[sheetIndex];
            if (!worksheet) {
                throw new Error(`Sheet at index ${sheetIndex} not found`);
            }
            return this.parseWorksheet(worksheet, sheetIndex, options);
        });
    }
    /**
     * Parse all sheets in Excel file
     */
    static parseAllSheets(buffer_1) {
        return __awaiter(this, arguments, void 0, function* (buffer, options = {}) {
            const workbook = new ExcelJS.Workbook();
            yield workbook.xlsx.load(buffer);
            const sheets = [];
            for (let i = 0; i < workbook.worksheets.length; i++) {
                const worksheet = workbook.worksheets[i];
                const parsedSheet = this.parseWorksheet(worksheet, i, options);
                sheets.push(parsedSheet);
            }
            return sheets;
        });
    }
    /**
     * Parse specific sheets by name list
     */
    static parseSpecificSheets(buffer_1, sheetNames_1) {
        return __awaiter(this, arguments, void 0, function* (buffer, sheetNames, options = {}) {
            const workbook = new ExcelJS.Workbook();
            yield workbook.xlsx.load(buffer);
            const sheets = [];
            for (const sheetName of sheetNames) {
                const worksheet = workbook.worksheets.find(ws => ws.name === sheetName);
                if (worksheet) {
                    const sheetIndex = workbook.worksheets.indexOf(worksheet);
                    const parsedSheet = this.parseWorksheet(worksheet, sheetIndex, options);
                    sheets.push(parsedSheet);
                }
            }
            return sheets;
        });
    }
    /**
     * Validate multi-sheet structure
     */
    static validateMultiSheetStructure(buffer, validation) {
        return __awaiter(this, void 0, void 0, function* () {
            const workbook = new ExcelJS.Workbook();
            yield workbook.xlsx.load(buffer);
            const errors = [];
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
                const headers = headerRow.values;
                headers.shift();
                const missingColumns = requiredColumns.filter(col => !headers.includes(col));
                if (missingColumns.length > 0) {
                    errors.push({ sheetName, missingColumns });
                }
            }
            return {
                valid: errors.length === 0,
                errors
            };
        });
    }
    /**
     * Private helper: Parse single worksheet
     */
    static parseWorksheet(worksheet, sheetIndex, options = {}) {
        const { skipEmptyRows = true, trimValues = true } = options;
        const rows = [];
        let headers = [];
        worksheet.eachRow((row, rowNumber) => {
            // First row is headers
            if (rowNumber === 1) {
                headers = row.values;
                headers.shift(); // Remove first empty element from ExcelJS
                return;
            }
            const values = row.values;
            values.shift(); // Remove first empty element
            // Skip empty rows
            if (skipEmptyRows && values.every(v => !v)) {
                return;
            }
            // Map to object
            const rowData = {};
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
exports.ExcelParserService = ExcelParserService;
