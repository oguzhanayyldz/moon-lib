"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CargoIntegration = void 0;
const integration_type_1 = require("../types/integration-type");
const base_integration_1 = require("./base-integration");
/**
 * Cargo Integration Base Class
 *
 * Kargo entegrasyonları için temel sınıf.
 * Marketplace ve E-commerce entegrasyonlarından farklı olarak:
 * - Sipariş verilerinden kargo gönderimi oluşturur
 * - Kargo etiketlerini yazdırır
 * - Kargo takip bilgilerini sorgular
 * - Kargo iptal işlemlerini yönetir
 *
 * Örnek Cargo Integration'lar:
 * - Aras Kargo
 * - MNG Kargo
 * - Yurtiçi Kargo
 * - PTT Kargo
 * - UPS, DHL, FedEx (uluslararası)
 *
 * @abstract
 * @extends BaseIntegration
 */
class CargoIntegration extends base_integration_1.BaseIntegration {
    constructor() {
        super();
        this.type = integration_type_1.IntegrationType.Cargo;
    }
}
exports.CargoIntegration = CargoIntegration;
