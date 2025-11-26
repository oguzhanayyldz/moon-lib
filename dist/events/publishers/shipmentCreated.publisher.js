"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShipmentCreatedPublisher = void 0;
const common_1 = require("../../common");
/**
 * ShipmentCreated Publisher
 *
 * Kargo gönderimi oluşturulduğunda event yayınlar.
 * Shipment Service tarafından kullanılır.
 *
 * Orders Service bu event'i dinleyerek OrderCargo'yu günceller.
 */
class ShipmentCreatedPublisher extends common_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = common_1.Subjects.ShipmentCreated;
    }
}
exports.ShipmentCreatedPublisher = ShipmentCreatedPublisher;
