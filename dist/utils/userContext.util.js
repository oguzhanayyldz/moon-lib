"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPerformerId = getPerformerId;
exports.getDataOwnerId = getDataOwnerId;
exports.isSubUserMode = isSubUserMode;
exports.getParentUserId = getParentUserId;
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
function getPerformerId(user) {
    if (user.isSubUserMode && user.subUserId) {
        return user.subUserId; // SubUser'ın gerçek ID'si
    }
    return user.id; // Normal kullanıcı ID'si (Parent User)
}
/**
 * Veri erişimi için kullanıcı ID'sini döndürür
 * Her zaman parent user ID döner (SubUser modunda bile)
 *
 * Veri sahipliği alanları için kullanılmalı:
 * - Entity.user alanı (filtreleme için)
 * - Sahiplik kontrolü
 */
function getDataOwnerId(user) {
    return user.id; // Bu zaten parent ID (SubUser modunda)
}
/**
 * SubUser modu kontrolü
 */
function isSubUserMode(user) {
    return user.isSubUserMode === true && !!user.subUserId;
}
/**
 * SubUser'ın parent User ID'sini döndürür
 * Güvenlik kontrollerinde kullanılır
 */
function getParentUserId(user) {
    // SubUser modunda req.currentUser.id zaten parent ID
    return user.id;
}
