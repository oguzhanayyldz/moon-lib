"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidWorkPackageStatusTransition = exports.WORK_PACKAGE_STATUS_TRANSITIONS = exports.WorkPackageStatus = void 0;
/**
 * İş Paketi Durumu
 * İş paketinin hangi aşamada olduğunu belirler
 */
var WorkPackageStatus;
(function (WorkPackageStatus) {
    /** İş paketi oluşturuldu, henüz başlamadı */
    WorkPackageStatus["Created"] = "Created";
    /** Toplama aşamasında */
    WorkPackageStatus["Picking"] = "Picking";
    /** Toplama tamamlandı */
    WorkPackageStatus["Picked"] = "Picked";
    /** Ayrıştırma aşamasında (sadece MultiItem için) */
    WorkPackageStatus["Sorting"] = "Sorting";
    /** Ayrıştırma tamamlandı (sadece MultiItem için) */
    WorkPackageStatus["Sorted"] = "Sorted";
    /** Paketleme aşamasında */
    WorkPackageStatus["Packing"] = "Packing";
    /** Tamamlandı */
    WorkPackageStatus["Completed"] = "Completed";
    /** İptal edildi */
    WorkPackageStatus["Cancelled"] = "Cancelled";
})(WorkPackageStatus || (exports.WorkPackageStatus = WorkPackageStatus = {}));
/**
 * İş paketi durum geçişleri
 */
exports.WORK_PACKAGE_STATUS_TRANSITIONS = {
    [WorkPackageStatus.Created]: [
        WorkPackageStatus.Picking,
        WorkPackageStatus.Cancelled
    ],
    [WorkPackageStatus.Picking]: [
        WorkPackageStatus.Picked, // Toplama tamamlandı
        WorkPackageStatus.Sorting, // MultiItem için direkt ayrıştırmaya
        WorkPackageStatus.Packing, // SingleItem için direkt paketlemeye
        WorkPackageStatus.Cancelled
    ],
    [WorkPackageStatus.Picked]: [
        WorkPackageStatus.Sorting, // MultiItem için ayrıştırmaya
        WorkPackageStatus.Packing, // SingleItem için paketlemeye
        WorkPackageStatus.Cancelled
    ],
    [WorkPackageStatus.Sorting]: [
        WorkPackageStatus.Sorted, // Ayrıştırma tamamlandı
        WorkPackageStatus.Packing,
        WorkPackageStatus.Cancelled
    ],
    [WorkPackageStatus.Sorted]: [
        WorkPackageStatus.Packing,
        WorkPackageStatus.Cancelled
    ],
    [WorkPackageStatus.Packing]: [
        WorkPackageStatus.Completed,
        WorkPackageStatus.Cancelled
    ],
    [WorkPackageStatus.Completed]: [],
    [WorkPackageStatus.Cancelled]: []
};
/**
 * Durum geçişinin geçerli olup olmadığını kontrol eder
 */
const isValidWorkPackageStatusTransition = (fromStatus, toStatus) => {
    var _a;
    return ((_a = exports.WORK_PACKAGE_STATUS_TRANSITIONS[fromStatus]) === null || _a === void 0 ? void 0 : _a.includes(toStatus)) || false;
};
exports.isValidWorkPackageStatusTransition = isValidWorkPackageStatusTransition;
