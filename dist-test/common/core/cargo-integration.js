"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CargoIntegration = void 0;
const integration_type_1 = require("../types/integration-type");
const base_integration_1 = require("./base-integration");
/**
 * Cargo Integration Base Class
 *
 * Kargo entegrasyonları için temel sınıf.
 *
 * @abstract
 * @extends BaseIntegration
 */
class CargoIntegration extends base_integration_1.BaseIntegration {
    constructor() {
        super();
        this.type = integration_type_1.IntegrationType.Cargo;
    }
    /**
     * Adres doğrulama
     */
    async validateAddress(_address) {
        return {
            valid: true,
            message: 'Address validation not supported by this cargo provider'
        };
    }
    /**
     * Kargo maliyeti hesaplama
     */
    async calculateShippingCost(_params) {
        throw new Error('Shipping cost calculation not supported by this cargo provider');
    }
    /**
     * Şube/dağıtım merkezi sorgulama
     */
    async getBranches(_city, _district) {
        return [];
    }
}
exports.CargoIntegration = CargoIntegration;
//# sourceMappingURL=cargo-integration.js.map