"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDeviceBarcodes = exports.encodeDeviceBarcode = exports.chunkArray = exports.sortByField = exports.calculatePriceWithoutTax = exports.calculateTaxPrice = exports.sleep = exports.clearRef = exports.generateEanBarcode = exports.parseFloatTry = exports.parseIntTry = exports.createShelfBarcodes = exports.encodeShelfBarcode = exports.getRefDataId = exports.generateRandomString = exports.createUniqueCode = void 0;
exports.convertMapToObject = convertMapToObject;
exports.convertObjectToMap = convertObjectToMap;
exports.mergeMaps = mergeMaps;
;
const bson_1 = require("bson");
const bad_request_error_1 = require("../errors/bad-request-error");
//NOTE - Veriler ile unique bir string yaratıyor. 
// Veritabanı içerisinde benzer kayıtların oluşmaması için kullanılır
const createUniqueCode = (obj) => {
    let uniqueCode = ``;
    for (const i in obj) {
        if (obj[i] !== undefined && obj[i] !== null) {
            let str = (0, exports.getRefDataId)(obj[i]);
            uniqueCode += `${str.trim()}-`;
        }
    }
    let lastIndex = uniqueCode.lastIndexOf("-");
    if (lastIndex !== -1 && lastIndex === uniqueCode.length - 1) {
        uniqueCode = uniqueCode.slice(0, lastIndex);
    }
    return uniqueCode;
};
exports.createUniqueCode = createUniqueCode;
//NOTE - Uzunluk değeri alarak o uzunlukta random bir string oluşturur.
const generateRandomString = (length) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomString = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        randomString += characters.charAt(randomIndex);
    }
    return randomString;
};
exports.generateRandomString = generateRandomString;
//NOTE - ObjectId tipinde olan yani referans olan değerleri string tipine dönüştürür.
// Aynı şekilde eğer bir obje ise içerisindeki id alanına ulaşarak geri döner.
const getRefDataId = (data) => {
    //NOTE - ObjectId'yi doğrulayalım
    if (data && data.id && typeof data.id === "string") {
        return data.id.toString();
    }
    else if (bson_1.ObjectId.isValid(data)) {
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
exports.getRefDataId = getRefDataId;
//NOTE - Raflarda bulunan barkodları decode ederek hangi depo, raf, satır ve stun olduğunu döner.
const encodeShelfBarcode = (barcode) => {
    let splitStr = barcode.split("X");
    if (splitStr.length == 4) {
        for (const split of splitStr) {
            if (!(0, exports.parseIntTry)(split)) {
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
exports.encodeShelfBarcode = encodeShelfBarcode;
//NOTE - Bir rafın içerisinde bulunan tüm kolonların alacağı rafları sırası ile verir.
const createShelfBarcodes = (shelf) => {
    let barcodes = [];
    for (let r = 1; r <= shelf.row; r++) {
        for (let c = 1; c <= shelf.column; c++) {
            let barcode = `${shelf.warehouseAlternativeId}X${shelf.alternativeId}X${r}X${c}`;
            barcodes.push({ row: r, column: c, barcode: barcode });
        }
    }
    return barcodes;
};
exports.createShelfBarcodes = createShelfBarcodes;
//NOTE - Güvenli bir şekilde parseInt yapmak için bu metod kullanılır.
const parseIntTry = (value) => {
    const parsedValue = parseInt(value);
    //NOTE- parsedValue NaN ise veya dönüştürme başarısız olursa, false döndürülecek.
    if (isNaN(parsedValue)) {
        return false;
    }
    return parsedValue;
};
exports.parseIntTry = parseIntTry;
//NOTE - Güvenli bir şekilde parseFloat yapmak için bu metod kullanılır.
const parseFloatTry = (value) => {
    const parsedValue = parseFloat(value);
    //NOTE- parsedValue NaN ise veya dönüştürme başarısız olursa, false döndürülecek.
    if (isNaN(parsedValue)) {
        return false;
    }
    return parsedValue;
};
exports.parseFloatTry = parseFloatTry;
//NOTE - Ean barkod üretir ve geri döner.
const generateEanBarcode = () => {
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
exports.generateEanBarcode = generateEanBarcode;
//NOTE - Veri tabanı ile arasındaki referanslarından kaldırmak için kullanılır...
const clearRef = (data) => {
    return JSON.parse(JSON.stringify(data));
};
exports.clearRef = clearRef;
//NOTE - Kodu uyutmak için kullanılır...
const sleep = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};
exports.sleep = sleep;
//NOTE - Kdv fiyatını hesaplamak için kullanılır
const calculateTaxPrice = (total, tax) => {
    if (typeof total !== 'number' || typeof tax !== 'number' || total < 0 || tax < 0) {
        throw new bad_request_error_1.BadRequestError('Geçersiz tutar veya vergi yüzdesi.');
    }
    return parseFloat((total * (tax / 100)).toFixed(3));
};
exports.calculateTaxPrice = calculateTaxPrice;
//NOTE - Kdv hariç fiyatı hesaplamak için kullanılır
const calculatePriceWithoutTax = (total, tax) => {
    if (typeof total !== 'number' || typeof tax !== 'number' || total < 0 || tax < 0) {
        throw new bad_request_error_1.BadRequestError('Geçersiz tutar veya vergi yüzdesi.');
    }
    return parseFloat((total - (total * (tax / 100))).toFixed(3));
};
exports.calculatePriceWithoutTax = calculatePriceWithoutTax;
//NOTE - Bir array içerisindeki objeleri verilen alana göre sıralar.
const sortByField = (array, field, order = "asc") => {
    return array.sort((a, b) => {
        if (a[field] < b[field])
            return order === "asc" ? -1 : 1;
        if (a[field] > b[field])
            return order === "asc" ? 1 : -1;
        return 0;
    });
};
exports.sortByField = sortByField;
//NOTE - Bir array'i belirtilen boyuta göre parçalara böler.
// Örneğin, [1, 2, 3, 4, 5] ve chunkSize = 2 ise, [[1, 2], [3, 4], [5]] döner.
const chunkArray = (array, chunkSize) => {
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
};
exports.chunkArray = chunkArray;
//NOTE - Map nesnesini JSON'a çevirir ve recu00fcrsif olarak içindeki Map'leri Object'e çevirir.
function convertMapToObject(obj) {
    if (!obj)
        return obj;
    // Eu011fer bu bir Map nesnesi (toJSON metodu varsa) ise, JSON'a u00e7evir
    if (obj && typeof obj === 'object' && 'toJSON' in obj && typeof obj.toJSON === 'function') {
        return obj.toJSON();
    }
    // Nesne u00f6zelliklerini du00f6n ve recu00fcrsif olarak kontrol et
    if (typeof obj === 'object' && obj !== null) {
        const result = Array.isArray(obj) ? [] : {};
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
function convertObjectToMap(obj) {
    if (typeof obj !== 'object' || obj === null)
        return null;
    const map = new Map();
    for (const key of Object.keys(obj)) {
        map.set(key, obj[key]);
    }
    return map;
}
//NOTE - İki Map nesnesini birleştirir. Eğer aynı key varsa, ikinci Map'in değeri ile üzerine yazar.
function mergeMaps(map1, map2) {
    const merged = new Map(map1); // map1 kopyalanır
    for (const [key, value] of map2) {
        merged.set(key, value); // aynı key varsa ÜZERİNE YAZILIR
    }
    return merged;
}
//NOTE - Device slot barkodlarını decode ederek hangi depo, device, satır ve sütun olduğunu döner.
// Barkod formatı: warehouseAlternativeId X deviceAlternativeId X row X column (örn: 1X2X3X1)
const encodeDeviceBarcode = (barcode) => {
    let splitStr = barcode.split("X");
    if (splitStr.length == 4) {
        for (const split of splitStr) {
            if (!(0, exports.parseIntTry)(split)) {
                return null;
            }
        }
        return {
            warehouse: parseInt(splitStr[0]),
            device: parseInt(splitStr[1]),
            row: parseInt(splitStr[2]),
            column: parseInt(splitStr[3])
        };
    }
    return null;
};
exports.encodeDeviceBarcode = encodeDeviceBarcode;
//NOTE - Bir SortingRack device'ının tüm slot barkodlarını oluşturur.
// Barkod formatı: warehouseAlternativeId X deviceAlternativeId X row X column
const createDeviceBarcodes = (device) => {
    var _a, _b;
    let barcodes = [];
    const rows = ((_a = device.capacity) === null || _a === void 0 ? void 0 : _a.rows) || 0;
    const columns = ((_b = device.capacity) === null || _b === void 0 ? void 0 : _b.columns) || 0;
    for (let r = 1; r <= rows; r++) {
        for (let c = 1; c <= columns; c++) {
            let barcode = `${device.warehouseAlternativeId}X${device.alternativeId}X${r}X${c}`;
            barcodes.push({ row: r, column: c, barcode: barcode });
        }
    }
    return barcodes;
};
exports.createDeviceBarcodes = createDeviceBarcodes;
//# sourceMappingURL=core.js.map