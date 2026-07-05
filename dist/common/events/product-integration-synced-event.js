"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveIntegrationStatusFromApproval = resolveIntegrationStatusFromApproval;
const integration_status_1 = require("../types/integration-status");
/**
 * Pazaryeri onay durumunu (approvalStatus) CatalogMapping integrationData.status'üne çevirir.
 * Catalog listener'ları (matchProducts, productCreated) tek kaynaktan kullanır.
 * Alan gelmezse (producer sinyal göndermediyse) eski davranış korunur: Active → tam geriye uyumlu.
 * - 'pending'  → PendingApproval (gönderildi, pazaryeri onayı bekliyor — matchProducts eşleşmeye DEVAM eder)
 * - 'rejected' → Failed
 * - 'approved'/undefined → Active
 */
function resolveIntegrationStatusFromApproval(approvalStatus) {
    switch (approvalStatus) {
        case 'approved': return integration_status_1.IntegrationStatus.Active;
        case 'pending': return integration_status_1.IntegrationStatus.PendingApproval;
        case 'rejected': return integration_status_1.IntegrationStatus.Failed;
        // Producer sinyal göndermedi (eski producer'lar) → geriye tam uyumlu: Active
        case undefined: return integration_status_1.IntegrationStatus.Active;
        // Beklenmeyen/bozuk değer → fail-safe: körü körüne Active YAPMA, onaya al (PendingApproval)
        default: return integration_status_1.IntegrationStatus.PendingApproval;
    }
}
