/**
 * IntegrationRouter sınıfı
 * 
 * Mikroservisler arası entegrasyon iletişimi için NATS subject yollarını oluşturan yardımcı sınıf.
 * Özellikle request-reply pattern kullanımı için merkezi bir format sağlar.
 */
export class IntegrationRouter {
    /**
     * NATS mesajlarında kullanılacak subject formatı
     * {integration_type}: ecommerce, marketplaces, erp, cargo vb.
     * {platform}: shopify, trendyol, n11, amazon vb.
     */
    private static readonly SUBJECT_TEMPLATE = 'integration:{integration_type}:{platform}:command';

    /**
     * Belirli bir entegrasyon tipi ve platform için hedef NATS subject'ini oluşturur
     * 
     * @param type Entegrasyon tipi (örn: "ecommerce", "marketplace")
     * @param platform Platform adı (örn: "shopify", "trendyol")
     * @returns NATS subject string
     * @throws Error - tip veya platform boş olduğunda
     */
    static getTargetSubject(type: string, platform: string): string {
        if (!platform) {
            throw new Error('Platform is required');
        }

        if (!type) {
            throw new Error('Type is required');
        }
        return this.SUBJECT_TEMPLATE.replace('{integration_type}', type.toLowerCase()).replace('{platform}', platform.toLowerCase());
    }
} 