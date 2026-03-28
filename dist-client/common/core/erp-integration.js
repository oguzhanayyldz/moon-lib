"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErpIntegration = void 0;
const integration_type_1 = require("../types/integration-type");
const base_integration_1 = require("./base-integration");
/**
 * ERP Integration Base Class
 *
 * ERP (Enterprise Resource Planning) entegrasyonları için temel sınıf.
 * Marketplace ve E-commerce entegrasyonlarından farklı olarak:
 * - Siparişleri çekmek yerine ERP'ye gönderir (fatura kesme)
 * - Ürün/stok kartı senkronizasyonu
 * - Cari (müşteri/tedarikçi) yönetimi
 * - Fatura resmileştirme işlemleri (e-Arşiv, e-Fatura)
 *
 * @abstract
 * @extends BaseIntegration
 */
class ErpIntegration extends base_integration_1.BaseIntegration {
    constructor() {
        super();
        this.type = integration_type_1.IntegrationType.Erp;
    }
}
exports.ErpIntegration = ErpIntegration;
