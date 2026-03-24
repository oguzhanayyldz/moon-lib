import { IntegrationType } from '../common/types/integration-type';
/**
 * IntegrationRouter sınıfı
 *
 * Mikroservisler arası entegrasyon iletişimi için NATS subject yollarını oluşturan yardımcı sınıf.
 * Özellikle request-reply pattern kullanımı için merkezi bir format sağlar.
 */
export declare class IntegrationRouter {
    /**
     * NATS mesajlarında kullanılacak subject formatı
     * {integration_type}: ecommerce, marketplaces, erp, cargo vb.
     * {platform}: shopify, trendyol, n11, amazon vb.
     */
    private static readonly SUBJECT_TEMPLATE;
    /**
     * Platform → IntegrationType merkezi mapping
     * Yeni entegrasyon eklendiğinde buraya eklenmeli
     */
    private static readonly PLATFORM_TYPE_MAP;
    /**
     * Platform adından IntegrationType'ı otomatik belirler
     */
    static getIntegrationType(platform: string): IntegrationType;
    /**
     * Belirli bir entegrasyon tipi ve platform için hedef NATS subject'ini oluşturur
     *
     * @param type Entegrasyon tipi (örn: "ecommerce", "marketplace")
     * @param platform Platform adı (örn: "shopify", "trendyol", "Aras Kargo")
     * @returns NATS subject string
     * @throws Error - tip veya platform boş olduğunda
     */
    static getTargetSubject(type: string, platform: string): string;
}
