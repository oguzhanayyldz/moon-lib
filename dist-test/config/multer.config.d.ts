import multer from 'multer';
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
export declare const createExcelUpload: (maxSizeMB?: number) => multer.Multer;
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
export declare const createImageUpload: (maxSizeMB?: number) => multer.Multer;
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
export declare const createGenericUpload: (maxSizeMB?: number, allowedMimeTypes?: string[]) => multer.Multer;
//# sourceMappingURL=multer.config.d.ts.map