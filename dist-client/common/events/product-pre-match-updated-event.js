"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRODUCT_PRE_MATCH_STATUSES = void 0;
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
