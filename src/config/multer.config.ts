import multer from 'multer';
import { BadRequestError } from '../common/errors';

/**
 * Ortak Multer Configuration
 *
 * Tüm microservislerde kullanılabilecek file upload konfigürasyonları
 */

// Memory storage - dosyayı buffer olarak alacağız
const memoryStorage = multer.memoryStorage();

/**
 * Excel dosya filtresi - sadece .xlsx kabul eder
 */
const excelFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (
    file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.originalname.endsWith('.xlsx')
  ) {
    cb(null, true);
  } else {
    cb(new BadRequestError('Sadece .xlsx formatındaki dosyalar kabul edilir'));
  }
};

/**
 * Image dosya filtresi - tüm image formatları kabul eder
 */
const imageFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new BadRequestError('Sadece resim dosyaları kabul edilir'));
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
export const createExcelUpload = (maxSizeMB: number = 10) => {
  return multer({
    storage: memoryStorage,
    fileFilter: excelFileFilter,
    limits: {
      fileSize: maxSizeMB * 1024 * 1024
    }
  });
};

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
export const createImageUpload = (maxSizeMB: number = 5) => {
  return multer({
    storage: memoryStorage,
    fileFilter: imageFileFilter,
    limits: {
      fileSize: maxSizeMB * 1024 * 1024
    }
  });
};

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
export const createGenericUpload = (
  maxSizeMB: number = 10,
  allowedMimeTypes?: string[]
) => {
  const fileFilter = allowedMimeTypes
    ? (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
        if (allowedMimeTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestError(
            `Sadece şu dosya tipleri kabul edilir: ${allowedMimeTypes.join(', ')}`
          ));
        }
      }
    : undefined; // undefined = tüm dosya tiplerini kabul et

  return multer({
    storage: memoryStorage,
    fileFilter,
    limits: {
      fileSize: maxSizeMB * 1024 * 1024
    }
  });
};
