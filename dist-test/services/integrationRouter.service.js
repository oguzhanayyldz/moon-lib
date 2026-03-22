"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationRouter = void 0;
const resourceName_1 = require("../common/types/resourceName");
const integration_type_1 = require("../common/types/integration-type");
/**
 * IntegrationRouter sınıfı
 *
 * Mikroservisler arası entegrasyon iletişimi için NATS subject yollarını oluşturan yardımcı sınıf.
 * Özellikle request-reply pattern kullanımı için merkezi bir format sağlar.
 */
class IntegrationRouter {
    /**
     * Platform adından IntegrationType'ı otomatik belirler
     */
    static getIntegrationType(platform) {
        return this.PLATFORM_TYPE_MAP[platform] || integration_type_1.IntegrationType.MarketPlace;
    }
    /**
     * Belirli bir entegrasyon tipi ve platform için hedef NATS subject'ini oluşturur
     *
     * @param type Entegrasyon tipi (örn: "ecommerce", "marketplace")
     * @param platform Platform adı (örn: "shopify", "trendyol", "Aras Kargo")
     * @returns NATS subject string
     * @throws Error - tip veya platform boş olduğunda
     */
    static getTargetSubject(type, platform) {
        if (!platform) {
            throw new Error('Platform is required');
        }
        if (!type) {
            throw new Error('Type is required');
        }
        // Platform adını NATS subject formatına uygun hale getir
        const normalizedPlatform = platform
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[ğ]/g, 'g')
            .replace(/[ü]/g, 'u')
            .replace(/[ş]/g, 's')
            .replace(/[ı]/g, 'i')
            .replace(/[ö]/g, 'o')
            .replace(/[ç]/g, 'c')
            .replace(/[^a-z0-9-]/g, '');
        return this.SUBJECT_TEMPLATE.replace('{integration_type}', type.toLowerCase()).replace('{platform}', normalizedPlatform);
    }
}
exports.IntegrationRouter = IntegrationRouter;
/**
 * NATS mesajlarında kullanılacak subject formatı
 * {integration_type}: ecommerce, marketplaces, erp, cargo vb.
 * {platform}: shopify, trendyol, n11, amazon vb.
 */
IntegrationRouter.SUBJECT_TEMPLATE = 'integration:{integration_type}:{platform}:command';
/**
 * Platform → IntegrationType merkezi mapping
 * Yeni entegrasyon eklendiğinde buraya eklenmeli
 */
IntegrationRouter.PLATFORM_TYPE_MAP = {
    [resourceName_1.ResourceName.Shopify]: integration_type_1.IntegrationType.Ecommerce,
    [resourceName_1.ResourceName.Ikas]: integration_type_1.IntegrationType.Ecommerce,
    [resourceName_1.ResourceName.Trendyol]: integration_type_1.IntegrationType.MarketPlace,
    [resourceName_1.ResourceName.Hepsiburada]: integration_type_1.IntegrationType.MarketPlace,
    [resourceName_1.ResourceName.Amazon]: integration_type_1.IntegrationType.MarketPlace,
    [resourceName_1.ResourceName.N11]: integration_type_1.IntegrationType.MarketPlace,
    [resourceName_1.ResourceName.CicekSepeti]: integration_type_1.IntegrationType.MarketPlace,
    [resourceName_1.ResourceName.Parasut]: integration_type_1.IntegrationType.Erp,
    [resourceName_1.ResourceName.Aras]: integration_type_1.IntegrationType.Cargo,
    [resourceName_1.ResourceName.Yurtici]: integration_type_1.IntegrationType.Cargo,
};
//# sourceMappingURL=integrationRouter.service.js.map