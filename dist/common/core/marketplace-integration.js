"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketPlaceIntegration = void 0;
const integration_type_1 = require("../types/integration-type");
const base_integration_1 = require("./base-integration");
class MarketPlaceIntegration extends base_integration_1.BaseIntegration {
    constructor() {
        super();
        this.type = integration_type_1.IntegrationType.MarketPlace;
    }
}
exports.MarketPlaceIntegration = MarketPlaceIntegration;
