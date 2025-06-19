"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationStatus = void 0;
var IntegrationStatus;
(function (IntegrationStatus) {
    IntegrationStatus["Active"] = "active";
    IntegrationStatus["Inactive"] = "inactive";
    IntegrationStatus["Pending"] = "pending";
    IntegrationStatus["Failed"] = "failed";
    IntegrationStatus["Syncing"] = "syncing";
    IntegrationStatus["SyncFailed"] = "sync_failed";
    IntegrationStatus["Deleted"] = "deleted";
})(IntegrationStatus || (exports.IntegrationStatus = IntegrationStatus = {}));
