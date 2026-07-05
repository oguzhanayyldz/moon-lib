"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationStatus = void 0;
var IntegrationStatus;
(function (IntegrationStatus) {
    IntegrationStatus["Active"] = "active";
    IntegrationStatus["Inactive"] = "inactive";
    IntegrationStatus["Pending"] = "pending";
    // Ürün pazaryerine gönderildi/eşleşti ama pazaryeri henüz ONAYLAMADI (ara statü).
    // Pending ("henüz senkron olmadı") ile karıştırma. matchProducts bu üründe eşleşmeye
    // devam eder; pazaryeri onaylayınca sonraki run'da Active'e döner.
    IntegrationStatus["PendingApproval"] = "pending_approval";
    IntegrationStatus["Failed"] = "failed";
    IntegrationStatus["Syncing"] = "syncing";
    IntegrationStatus["SyncFailed"] = "sync_failed";
    IntegrationStatus["Deleted"] = "deleted";
})(IntegrationStatus || (exports.IntegrationStatus = IntegrationStatus = {}));
