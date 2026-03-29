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
    validateAddress(_address) {
        return __awaiter(this, void 0, void 0, function* () {
            return {
                valid: true,
                message: 'Address validation not supported by this cargo provider'
            };
        });
    }
    /**
     * Kargo maliyeti hesaplama
     */
    calculateShippingCost(_params) {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error('Shipping cost calculation not supported by this cargo provider');
        });
    }
    /**
     * Şube/dağıtım merkezi sorgulama
     */
    getBranches(_city, _district) {
        return __awaiter(this, void 0, void 0, function* () {
            return [];
        });
    }
}
exports.CargoIntegration = CargoIntegration;
