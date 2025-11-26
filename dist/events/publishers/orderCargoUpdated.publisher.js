"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderCargoUpdatedPublisher = void 0;
const common_1 = require("../../common");
/**
 * OrderCargoUpdated Publisher
 *
 * OrderCargo bilgileri güncellendiğinde event yayınlar.
 * Shipment Service tarafından kullanılır.
 */
class OrderCargoUpdatedPublisher extends common_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = common_1.Subjects.OrderCargoUpdated;
    }
}
exports.OrderCargoUpdatedPublisher = OrderCargoUpdatedPublisher;
