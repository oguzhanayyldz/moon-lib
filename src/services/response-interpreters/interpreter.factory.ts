import { ResourceName } from '../../common';
import { BaseResponseInterpreter } from './base.interpreter';
import { TrendyolResponseInterpreter } from './trendyol.interpreter';
import { ShopifyResponseInterpreter } from './shopify.interpreter';
import { logger } from '../logger.service';

/**
 * Response Interpreter Factory
 * Platform'a göre uygun interpreter instance'ını döndürür
 */
export class ResponseInterpreterFactory {
    private static interpreters: Map<ResourceName, BaseResponseInterpreter> = new Map();

    /**
     * Platform'a göre interpreter döndür
     */
    static getInterpreter(integrationName: ResourceName): BaseResponseInterpreter | null {
        // Cache'den kontrol et
        if (this.interpreters.has(integrationName)) {
            return this.interpreters.get(integrationName)!;
        }

        // Yeni interpreter oluştur
        let interpreter: BaseResponseInterpreter | null = null;

        switch (integrationName) {
            case ResourceName.Trendyol:
                interpreter = new TrendyolResponseInterpreter();
                break;

            case ResourceName.Shopify:
                interpreter = new ShopifyResponseInterpreter();
                break;

            // Diğer platform'lar için ileride eklenebilir
            case ResourceName.Hepsiburada:
            case ResourceName.N11:
            case ResourceName.Amazon:
            case ResourceName.CicekSepeti:
                logger.debug(`No interpreter implementation for ${integrationName} yet`);
                return null;

            default:
                logger.debug(`Unknown integration name: ${integrationName}`);
                return null;
        }

        // Cache'e ekle
        if (interpreter) {
            this.interpreters.set(integrationName, interpreter);
        }

        return interpreter;
    }

    /**
     * Cache'i temizle (test için kullanılabilir)
     */
    static clearCache(): void {
        this.interpreters.clear();
    }
}
