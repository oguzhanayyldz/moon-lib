"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGenericUpload = exports.createImageUpload = exports.createExcelUpload = void 0;
const multer_1 = __importDefault(require("multer"));
const errors_1 = require("../common/errors");
/**
 * Ortak Multer Configuration
 *
 * Tüm microservislerde kullanılabilecek file upload konfigürasyonları
 */
// Memory storage - dosyayı buffer olarak alacağız
const memoryStorage = multer_1.default.memoryStorage();
/**
 * Excel dosya filtresi - sadece .xlsx kabul eder
 */
const excelFileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.originalname.endsWith('.xlsx')) {
        cb(null, true);
    }
    else {
        cb(new errors_1.BadRequestError('Sadece .xlsx formatındaki dosyalar kabul edilir'));
    }
};
/**
 * Image dosya filtresi - tüm image formatları kabul eder
 */
const imageFileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    }
    else {
        cb(new errors_1.BadRequestError('Sadece resim dosyaları kabul edilir'));
    }
};
/**
 * Excel upload için multer instance oluşturur
 *
 * @param maxSizeMB - Maximum dosya boyutu (MB), varsayılan: 10MB
 * @returns Multer instance
 *
 * @example
 * ```typescript
 * import { createExcelUpload } from '@xmoonx/moon-lib';
 *
 * const excelUpload = createExcelUpload(10); // 10MB limit
 *
 * router.post('/api/products/excel/import',
 *   requireAuth,
 *   excelUpload.single('file'),
 *   async (req, res) => {
 *     const buffer = req.file?.buffer;
 *     // ...
 *   }
 * );
 * ```
 */
const createExcelUpload = (maxSizeMB = 10) => {
    return (0, multer_1.default)({
        storage: memoryStorage,
        fileFilter: excelFileFilter,
        limits: {
            fileSize: maxSizeMB * 1024 * 1024
        }
    });
};
exports.createExcelUpload = createExcelUpload;
/**
 * Image upload için multer instance oluşturur
 *
 * @param maxSizeMB - Maximum dosya boyutu (MB), varsayılan: 5MB
 * @returns Multer instance
 *
 * @example
 * ```typescript
 * import { createImageUpload } from '@xmoonx/moon-lib';
 *
 * const imageUpload = createImageUpload(5); // 5MB limit
 *
 * router.post('/api/cdn/upload',
 *   requireAuth,
 *   imageUpload.single('image'),
 *   async (req, res) => {
 *     const buffer = req.file?.buffer;
 *     // ...
 *   }
 * );
 * ```
 */
const createImageUpload = (maxSizeMB = 5) => {
    return (0, multer_1.default)({
        storage: memoryStorage,
        fileFilter: imageFileFilter,
        limits: {
            fileSize: maxSizeMB * 1024 * 1024
        }
    });
};
exports.createImageUpload = createImageUpload;
/**
 * Generic file upload için multer instance oluşturur (herhangi bir dosya türü)
 *
 * @param maxSizeMB - Maximum dosya boyutu (MB), varsayılan: 10MB
 * @param allowedMimeTypes - İzin verilen MIME tipleri (opsiyonel)
 * @returns Multer instance
 *
 * @example
 * ```typescript
 * import { createGenericUpload } from '@xmoonx/moon-lib';
 *
 * // Tüm dosya tiplerini kabul et
 * const anyUpload = createGenericUpload(20);
 *
 * // Sadece PDF ve Word dosyalarını kabul et
 * const docUpload = createGenericUpload(10, [
 *   'application/pdf',
 *   'application/msword',
 *   'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
 * ]);
 * ```
 */
const createGenericUpload = (maxSizeMB = 10, allowedMimeTypes) => {
    const fileFilter = allowedMimeTypes
        ? (req, file, cb) => {
            if (allowedMimeTypes.includes(file.mimetype)) {
                cb(null, true);
            }
            else {
                cb(new errors_1.BadRequestError(`Sadece şu dosya tipleri kabul edilir: ${allowedMimeTypes.join(', ')}`));
            }
        }
        : undefined; // undefined = tüm dosya tiplerini kabul et
    return (0, multer_1.default)({
        storage: memoryStorage,
        fileFilter,
        limits: {
            fileSize: maxSizeMB * 1024 * 1024
        }
    });
};
exports.createGenericUpload = createGenericUpload;
