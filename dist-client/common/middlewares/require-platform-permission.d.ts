import { Request, Response, NextFunction } from 'express';
/**
 * Platform-Aware Permission Middleware
 *
 * Integration ve Catalog resource'ları için platform bazlı yetkilendirme sağlar.
 * Permission constraints içinde platforms dizisi kontrol edilir.
 *
 * @example
 * // Integration trigger endpoint
 * requirePlatformPermission(
 *   'integrations',
 *   'update',
 *   (req) => req.params.integrationId
 * )
 *
 * // Catalog mapping endpoint
 * requirePlatformPermission(
 *   'catalogs',
 *   'create',
 *   (req) => req.body.integrationName
 * )
 */
export declare const requirePlatformPermission: (resource: string, action: string, getPlatformId: (req: Request) => string | undefined, options?: {
    errorMessage?: string;
    logAccess?: boolean;
    allowNoConstraints?: boolean;
}) => (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
/**
 * Integration ID'den platform ismini çıkartan helper function
 * Integration document'inde platform adı saklanıyorsa kullanılabilir
 */
export declare const extractPlatformFromIntegrationId: (integrationId: string, IntegrationModel: any) => Promise<string | undefined>;
/**
 * Integration name'den platform ismini normalize eden helper
 * Örnek: 'trendyol_marketplace' -> 'trendyol'
 */
export declare const normalizePlatformName: (platformName: string) => string;
