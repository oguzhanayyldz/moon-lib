"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketPlaceIntegration = void 0;
const integration_type_1 = require("../types/integration-type");
const base_integration_1 = require("./base-integration");
const logger_service_1 = require("../../services/logger.service");
class MarketPlaceIntegration extends base_integration_1.BaseIntegration {
    constructor() {
        super();
        this.type = integration_type_1.IntegrationType.MarketPlace;
    }
    // === DEFAULT IMPLEMENTATIONS ===
    async syncBrands(_params) {
        logger_service_1.logger.info(`${this.constructor.name}: syncBrands not supported`);
    }
    async sendTracking(_params) {
        logger_service_1.logger.info(`${this.constructor.name}: sendTracking not supported`);
        return { success: false, message: 'Not supported by this platform' };
    }
}
exports.MarketPlaceIntegration = MarketPlaceIntegration;
//# sourceMappingURL=marketplace-integration.js.map