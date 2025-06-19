import { ShelfBarcodesList } from "../types/shelf-barcodes-list";
export declare const createUniqueCode: (obj: any) => string;
export declare const generateRandomString: (length: number) => string;
export declare const getRefDataId: (data: any) => string;
interface ShelfBarcode {
    warehouse: number;
    shelf: number;
    row: number;
    column: number;
}
export declare const encodeShelfBarcode: (barcode: string) => ShelfBarcode | null;
interface Shelf {
    warehouseAlternativeId: number | string;
    alternativeId: number | string;
    row: number;
    column: number;
}
export declare const createShelfBarcodes: (shelf: Shelf) => ShelfBarcodesList[];
export declare const parseIntTry: (value: any) => number | false;
export declare const parseFloatTry: (value: any) => number | false;
export declare const generateEanBarcode: () => string;
export declare const clearRef: (data: any) => any;
export declare const sleep: (ms: number) => Promise<void>;
export declare const calculateTaxPrice: (total: number, tax: number) => number;
export declare const calculatePriceWithoutTax: (total: number, tax: number) => number;
export declare const sortByField: <T>(array: T[], field: keyof T, order?: "asc" | "desc") => T[];
export declare const chunkArray: (array: any[], chunkSize: number) => any[][];
export declare function convertMapToObject(obj: any): any;
export declare function convertObjectToMap(obj: any): Map<any, any> | null;
export declare function mergeMaps(map1: Map<any, any>, map2: Map<any, any>): Map<any, any>;
export {};
//# sourceMappingURL=core.d.ts.map