"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EcommerceIntegration = void 0;
const integration_type_1 = require("../types/integration-type");
const base_integration_1 = require("./base-integration");
class EcommerceIntegration extends base_integration_1.BaseIntegration {
    constructor() {
        super();
        this.type = integration_type_1.IntegrationType.Ecommerce;
    }
}
exports.EcommerceIntegration = EcommerceIntegration;
