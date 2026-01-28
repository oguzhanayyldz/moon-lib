"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EcommerceIntegration = void 0;
const integration_type_1 = require("../types/integration-type");
const base_integration_1 = require("./base-integration");
const logger_service_1 = require("../../services/logger.service");
class EcommerceIntegration extends base_integration_1.BaseIntegration {
    constructor() {
        super();
        this.type = integration_type_1.IntegrationType.Ecommerce;
    }
    // === DEFAULT IMPLEMENTATIONS ===
    async sendTracking(_params) {
        logger_service_1.logger.info(`${this.constructor.name}: sendTracking not supported`);
        return { success: false, message: 'Not supported by this platform' };
    }
    // === ECOMMERCE-ONLY DEFAULT IMPLEMENTATIONS ===
    async fetchLocations() {
        logger_service_1.logger.info(`${this.constructor.name}: fetchLocations not supported`);
        return { success: false, message: 'Not supported by this platform' };
    }
}
exports.EcommerceIntegration = EcommerceIntegration;
//# sourceMappingURL=ecommerce-integration.js.map