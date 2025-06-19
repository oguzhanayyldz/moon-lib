"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationRouter = void 0;
/**
 * IntegrationRouter sınıfı
 *
 * Mikroservisler arası entegrasyon iletişimi için NATS subject yollarını oluşturan yardımcı sınıf.
 * Özellikle request-reply pattern kullanımı için merkezi bir format sağlar.
 */
class IntegrationRouter {
    /**
     * Belirli bir entegrasyon tipi ve platform için hedef NATS subject'ini oluşturur
     *
     * @param type Entegrasyon tipi (örn: "ecommerce", "marketplace")
     * @param platform Platform adı (örn: "shopify", "trendyol")
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
        return this.SUBJECT_TEMPLATE.replace('{integration_type}', type.toLowerCase()).replace('{platform}', platform.toLowerCase());
    }
}
exports.IntegrationRouter = IntegrationRouter;
/**
 * NATS mesajlarında kullanılacak subject formatı
 * {integration_type}: ecommerce, marketplaces, erp, cargo vb.
 * {platform}: shopify, trendyol, n11, amazon vb.
 */
IntegrationRouter.SUBJECT_TEMPLATE = 'integration:{integration_type}:{platform}:command';
//# sourceMappingURL=integrationRouter.service.js.map