import { UserPayload } from '../common/middlewares/current-user';
/**
 * User Context Helper for SubUser Mode
 *
 * SubUser modunda işlem yapan kullanıcının doğru ID'sini belirlemek için kullanılır.
 *
 * SubUser Mode Yapısı:
 * - req.currentUser.id: Parent User ID (veri erişimi için)
 * - req.currentUser.subUserId: SubUser'ın gerçek ID'si (loglama için)
 * - req.currentUser.isSubUserMode: SubUser modunda mı?
 *
 * Kullanım Alanları:
 * - StockHistory.user
 * - PriceHistory.user
 * - WorkPackageHistory.performedBy
 * - OrderHistory.performedBy
 * - Invoice/Shipment loglama
 */
/**
 * İşlemi yapan kullanıcının ID'sini döndürür
 * SubUser modunda subUserId, normal modda id döner
 *
 * Loglama alanları için kullanılmalı:
 * - StockHistory.user
 * - PriceHistory.user
 * - WorkPackageHistory.performedBy
 * - OrderHistory.performedBy
 * - assignee alanları
 */
export declare function getPerformerId(user: UserPayload): string;
/**
 * Veri erişimi için kullanıcı ID'sini döndürür
 * Her zaman parent user ID döner (SubUser modunda bile)
 *
 * Veri sahipliği alanları için kullanılmalı:
 * - Entity.user alanı (filtreleme için)
 * - Sahiplik kontrolü
 */
export declare function getDataOwnerId(user: UserPayload): string;
/**
 * SubUser modu kontrolü
 */
export declare function isSubUserMode(user: UserPayload): boolean;
/**
 * SubUser'ın parent User ID'sini döndürür
 * Güvenlik kontrollerinde kullanılır
 */
export declare function getParentUserId(user: UserPayload): string;
//# sourceMappingURL=userContext.util.d.ts.map