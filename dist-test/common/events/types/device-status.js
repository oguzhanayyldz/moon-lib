"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceStatus = void 0;
/**
 * Araç Durumu
 * Depo araçlarının mevcut durumunu belirler
 */
var DeviceStatus;
(function (DeviceStatus) {
    /** Kullanılabilir durumda */
    DeviceStatus["Available"] = "Available";
    /** Kullanımda */
    DeviceStatus["InUse"] = "InUse";
    /** Bakımda */
    DeviceStatus["Maintenance"] = "Maintenance";
    /** Servis dışı */
    DeviceStatus["OutOfService"] = "OutOfService";
})(DeviceStatus || (exports.DeviceStatus = DeviceStatus = {}));
//# sourceMappingURL=device-status.js.map