"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRODUCT_PRE_MATCH_SKIP_REASONS = exports.PRODUCT_PRE_MATCH_STATUSES = void 0;
/**
 * Pazaryerinin "Eşleşen" (HB: PRE_MATCHED) ürün kararı durumu (TASK-MURHHI9UCDMZW).
 * - pending_approval     : platform kendi kataloğundaki bir ürünle eşleştirdi, satıcı kararı bekliyor
 * - auto_approved        : Moon "otomatik onayla" ayarıyla onayı platforma gönderdi
 * - approved / rejected  : kullanıcı Moon üzerinden elle onayladı / reddetti
 * - resolved_on_platform : önceki çekimde bekliyordu, artık platformda bekleyen listede değil
 *                          (ör. satıcı panelden karar verdi); sonucu integrationData.status gösterir
 */
exports.PRODUCT_PRE_MATCH_STATUSES = [
    'pending_approval',
    'auto_approved',
    'approved',
    'rejected',
    'resolved_on_platform'
];
/**
 * Otomatik onaya GİRMEYEN (elenen) bekleyen SKU'nun gerekçesi (UC-1170). Yalnız `pending_approval`
 * kayıtlarda, otomatik onay yolu çalışmışken SKU'yu eleyen neden varsa gelir; `lastError` (onay/red
 * DENEMESİ başarısız) ile karıştırılmaz — elenen SKU için HB'ye hiç istek gitmemiştir.
 * - not_sent_by_moon     : Moon'un gönderdiği (ve HB'nin olumlu teyit ettiği) SKU değil (panel/başka entegratör)
 * - auto_approve_off     : "otomatik onayla" ayarı kapalı ya da bu örnek güncel ayarı taşımıyor
 * - decision_in_progress : aynı SKU için elle karar / başka takip işi sürüyor (kilit meşgul)
 * - lock_unavailable     : karar kilidi alınamadı (geçici hata) — gece taraması yeniden dener
 * - settings_unverified  : ayarın güncelliği doğrulanamadı (Redis okuma hatası / ayar yeni değişti) — geçici,
 *                          sonraki taramada güncel ayarla yeniden denenir
 */
exports.PRODUCT_PRE_MATCH_SKIP_REASONS = [
    'not_sent_by_moon',
    'auto_approve_off',
    'decision_in_progress',
    'lock_unavailable',
    'settings_unverified'
];
