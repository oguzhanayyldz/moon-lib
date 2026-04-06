import { ResourceName } from '../common/types/resourceName';
import { IntegrationType } from '../common/types/integration-type';

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
     * Platform → IntegrationType merkezi mapping
     * Yeni entegrasyon eklendiğinde buraya eklenmeli
     */
    private static readonly PLATFORM_TYPE_MAP: Record<string, IntegrationType> = {
        [ResourceName.Shopify]: IntegrationType.Ecommerce,
        [ResourceName.Ikas]: IntegrationType.Ecommerce,
        [ResourceName.IdeaSoft]: IntegrationType.Ecommerce,
        [ResourceName.Trendyol]: IntegrationType.MarketPlace,
        [ResourceName.Hepsiburada]: IntegrationType.MarketPlace,
        [ResourceName.Amazon]: IntegrationType.MarketPlace,
        [ResourceName.N11]: IntegrationType.MarketPlace,
        [ResourceName.CicekSepeti]: IntegrationType.MarketPlace,
        [ResourceName.Parasut]: IntegrationType.Erp,
        [ResourceName.Aras]: IntegrationType.Cargo,
        [ResourceName.Yurtici]: IntegrationType.Cargo,
    };

    /**
     * Platform adından IntegrationType'ı otomatik belirler
     */
    static getIntegrationType(platform: string): IntegrationType {
        return this.PLATFORM_TYPE_MAP[platform] || IntegrationType.MarketPlace;
    }

    /**
     * Belirli bir entegrasyon tipi ve platform için hedef NATS subject'ini oluşturur
     *
     * @param type Entegrasyon tipi (örn: "ecommerce", "marketplace")
     * @param platform Platform adı (örn: "shopify", "trendyol", "Aras Kargo")
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