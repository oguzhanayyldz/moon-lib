"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShipmentUpdatedPublisher = void 0;
const common_1 = require("../../common");
/**
 * ShipmentUpdated Publisher
 *
 * Kargo gönderimi güncellendiğinde event yayınlar.
 * Shipment Service tarafından kullanılır.
 *
 * Kullanım senaryoları:
 * - syncOrdersStatus job'u cargo durumlarını güncellediğinde
 * - Kargo bilgileri manuel olarak güncellendiğinde
 *
 * Orders Service bu event'i dinleyerek OrderCargo'yu günceller.
 */
class ShipmentUpdatedPublisher extends common_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = common_1.Subjects.ShipmentUpdated;
    }
}
exports.ShipmentUpdatedPublisher = ShipmentUpdatedPublisher;
//# sourceMappingURL=shipmentUpdated.publisher.js.map