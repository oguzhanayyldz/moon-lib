"use strict";;

import { ObjectId } from "bson";
import { BadRequestError } from "../errors/bad-request-error";
import { ShelfBarcodesList } from "../types/shelf-barcodes-list";

//NOTE - Veriler ile unique bir string yaratıyor. 
// Veritabanı içerisinde benzer kayıtların oluşmaması için kullanılır
export const createUniqueCode = (obj: any): string => {
    let uniqueCode = ``;
    for (const i in obj) {
        if (obj[i] !== undefined && obj[i] !== null) {
            let str = getRefDataId(obj[i]);
            uniqueCode += `${str.trim()}-`;
        }
    }
    let lastIndex = uniqueCode.lastIndexOf("-");
    if (lastIndex !== -1 && lastIndex === uniqueCode.length - 1) {
        uniqueCode = uniqueCode.slice(0, lastIndex);
    }
    return uniqueCode;
};

//NOTE - Uzunluk değeri alarak o uzunlukta random bir string oluşturur.
export const generateRandomString = (length: number): string => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomString = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        randomString += characters.charAt(randomIndex);
    }
    return randomString;
};

//NOTE - ObjectId tipinde olan yani referans olan değerleri string tipine dönüştürür.
// Aynı şekilde eğer bir obje ise içerisindeki id alanına ulaşarak geri döner.
export const getRefDataId = (data: any): string => {
    //NOTE - ObjectId'yi doğrulayalım
    if (data && data.id && typeof data.id === "string") {
        return data.id.toString();
    }
    else if (ObjectId.isValid(data)) {
        if (data._id) {
            return data._id.toString();
        }
        else {
            return data.toString();
        }
        //NOTE - Doğrulanmış ObjectId ile devam edin
    }
    else if (typeof data == "object") {
        return data._id.toString();
    }
    else {
        return data.toString();
    }
};

interface ShelfBarcode {
    warehouse: number;
    shelf: number;
    row: number;
    column: number;
}

//NOTE - Raflarda bulunan barkodları decode ederek hangi depo, raf, satır ve stun olduğunu döner.
export const encodeShelfBarcode = (barcode: string): ShelfBarcode | null => {
    let splitStr = barcode.split("X");
    if (splitStr.length == 4) {
        for (const split of splitStr) {
            if (!parseIntTry(split)) {
                return null;
            }
        }
        return {
            warehouse: parseInt(splitStr[0]),
            shelf: parseInt(splitStr[1]),
            row: parseInt(splitStr[2]),
            column: parseInt(splitStr[3])
        };
    }
    return null;
};

interface Shelf {
    warehouseAlternativeId: number | string;
    alternativeId: number | string;
    row: number;
    column: number;
}

//NOTE - Bir rafın içerisinde bulunan tüm kolonların alacağı rafları sırası ile verir.
export const createShelfBarcodes = (shelf: Shelf): ShelfBarcodesList[] => {
    let barcodes: ShelfBarcodesList[] = [];
    for (let r = 1; r <= shelf.row; r++) {
        for (let c = 1; c <= shelf.column; c++) {
            let barcode = `${shelf.warehouseAlternativeId}X${shelf.alternativeId}X${r}X${c}`;
            barcodes.push({ row: r, column: c, barcode: barcode });
        }
    }
    return barcodes;
};

//NOTE - Güvenli bir şekilde parseInt yapmak için bu metod kullanılır.
export const parseIntTry = (value: any): number | false => {
    const parsedValue = parseInt(value);
    //NOTE- parsedValue NaN ise veya dönüştürme başarısız olursa, false döndürülecek.
    if (isNaN(parsedValue)) {
        return false;
    }
    return parsedValue;
};

//NOTE - Güvenli bir şekilde parseFloat yapmak için bu metod kullanılır.
export const parseFloatTry = (value: any): number | false => {
    const parsedValue = parseFloat(value);
    //NOTE- parsedValue NaN ise veya dönüştürme başarısız olursa, false döndürülecek.
    if (isNaN(parsedValue)) {
        return false;
    }
    return parsedValue;
};

//NOTE - Ean barkod üretir ve geri döner.
export const generateEanBarcode = (): string => {
    //NOTE - 12 haneli rastgele bir sayı oluşturuyoruz (ilk hane 0 olmamalı).
    let randomDigits = String(Math.floor(Math.random() * 9) + 1); // İlk hane 1-9 arasında olmalı.
    for (let i = 0; i < 11; i++) {
        randomDigits += String(Math.floor(Math.random() * 10));
    }
    //NOTE - Son hane (check digit) için çift ve tek basamakların toplamını hesaplayalım.
    let sumEven = 0;
    let sumOdd = 0;
    for (let i = 0; i < 12; i++) {
        if (i % 2 === 0) {
            sumEven += parseInt(randomDigits.charAt(i));
        }
        else {
            sumOdd += parseInt(randomDigits.charAt(i));
        }
    }
    //NOTE - Son hane (check digit) hesaplaması.
    let checkDigit = (10 - ((sumEven * 3 + sumOdd) % 10)) % 10;
    return randomDigits + String(checkDigit);
};

//NOTE - Veri tabanı ile arasındaki referanslarından kaldırmak için kullanılır...
export const clearRef = (data: any): any => {
    return JSON.parse(JSON.stringify(data));
};

//NOTE - Kodu uyutmak için kullanılır...
export const sleep = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

//NOTE - Kdv fiyatını hesaplamak için kullanılır
export const calculateTaxPrice = (total: number, tax: number): number => {
    if (typeof total !== 'number' || typeof tax !== 'number' || total < 0 || tax < 0) {
        throw new BadRequestError('Geçersiz tutar veya vergi yüzdesi.');
    }
    return parseFloat((total * (tax / 100)).toFixed(3));
};

//NOTE - Kdv hariç fiyatı hesaplamak için kullanılır
export const calculatePriceWithoutTax = (total: number, tax: number): number => {
    if (typeof total !== 'number' || typeof tax !== 'number' || total < 0 || tax < 0) {
        throw new BadRequestError('Geçersiz tutar veya vergi yüzdesi.');
    }
    return parseFloat((total - (total * (tax / 100))).toFixed(3));
};

//NOTE - Bir array içerisindeki objeleri verilen alana göre sıralar.
export const sortByField = <T>(array: T[], field: keyof T, order: "asc" | "desc" = "asc"): T[] => {
    return array.sort((a, b) => {
        if (a[field] < b[field])
            return order === "asc" ? -1 : 1;
        if (a[field] > b[field])
            return order === "asc" ? 1 : -1;
        return 0;
    });
};

//NOTE - Bir array'i belirtilen boyuta göre parçalara böler.
// Örneğin, [1, 2, 3, 4, 5] ve chunkSize = 2 ise, [[1, 2], [3, 4], [5]] döner.
export const chunkArray = (array: any[], chunkSize: number) => {
    if (!Array.isArray(array)) {
        throw new TypeError('First argument must be an array');
    }
    if (typeof chunkSize !== 'number' || chunkSize <= 0) {
        throw new TypeError('Chunk size must be a positive number');
    }

    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        const chunk = array.slice(i, i + chunkSize);
        chunks.push(chunk);
    }
    
    return chunks;
}

//NOTE - Map nesnesini JSON'a çevirir ve recu00fcrsif olarak içindeki Map'leri Object'e çevirir.
export function convertMapToObject(obj: any): any {
    if (!obj) return obj;

    // Eu011fer bu bir Map nesnesi (toJSON metodu varsa) ise, JSON'a u00e7evir
    if (obj && typeof obj === 'object' && 'toJSON' in obj && typeof obj.toJSON === 'function') {
        return obj.toJSON();
    }

    // Nesne u00f6zelliklerini du00f6n ve recu00fcrsif olarak kontrol et
    if (typeof obj === 'object' && obj !== null) {
        const result: any = Array.isArray(obj) ? [] : {};

        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                result[key] = convertMapToObject(obj[key]);
            }
        }

        return result;
    }

    return obj;
}

//NOTE - Object nesnesini Map'e çevirir.
export function convertObjectToMap(obj: any) {
    if (typeof obj !== 'object' || obj === null) return null;
    const map = new Map();
    for (const key of Object.keys(obj)) {
        map.set(key, obj[key]);
    }
    return map;
}

//NOTE - İki Map nesnesini birleştirir. Eğer aynı key varsa, ikinci Map'in değeri ile üzerine yazar.
export function mergeMaps(map1: Map<any, any>, map2: Map<any, any>): Map<any, any> {
    const merged = new Map(map1); // map1 kopyalanır

    for (const [key, value] of map2) {
      merged.set(key, value); // aynı key varsa ÜZERİNE YAZILIR
    }

    return merged;
}