"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
    syncBrands(_params) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_service_1.logger.info(`${this.constructor.name}: syncBrands not supported`);
        });
    }
    sendTracking(_params) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_service_1.logger.info(`${this.constructor.name}: sendTracking not supported`);
            return { success: false, message: 'Not supported by this platform' };
        });
    }
}
exports.MarketPlaceIntegration = MarketPlaceIntegration;
