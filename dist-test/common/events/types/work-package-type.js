"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkPackageType = void 0;
/**
 * İş Paketi Tipi
 * Tekli veya çoklu sipariş işleme türünü belirler
 */
var WorkPackageType;
(function (WorkPackageType) {
    /** Tek ürünlü siparişler - Toplama → Paketleme */
    WorkPackageType["SingleItem"] = "SingleItem";
    /** Çok ürünlü siparişler - Toplama → Ayrıştırma → Paketleme */
    WorkPackageType["MultiItem"] = "MultiItem";
})(WorkPackageType || (exports.WorkPackageType = WorkPackageType = {}));
//# sourceMappingURL=work-package-type.js.map