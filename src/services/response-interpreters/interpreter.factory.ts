import { ResourceName } from '../../common';
import { BaseResponseInterpreter } from './base.interpreter';
import { TrendyolResponseInterpreter } from './trendyol.interpreter';
import { ShopifyResponseInterpreter } from './shopify.interpreter';
import { HepsiburadaResponseInterpreter } from './hepsiburada.interpreter';
import { IkasResponseInterpreter } from './ikas.interpreter';
import { N11ResponseInterpreter } from './n11.interpreter';
import { IdeaSoftResponseInterpreter } from './ideasoft.interpreter';
import { HepsiJetResponseInterpreter } from './hepsijet.interpreter';
import { TSoftResponseInterpreter } from './tsoft.interpreter';
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

            case ResourceName.Hepsiburada:
                interpreter = new HepsiburadaResponseInterpreter();
                break;

            case ResourceName.Ikas:
                interpreter = new IkasResponseInterpreter();
                break;

            case ResourceName.N11:
                interpreter = new N11ResponseInterpreter();
                break;

            case ResourceName.IdeaSoft:
                interpreter = new IdeaSoftResponseInterpreter();
                break;

            case ResourceName.HepsiJet:
                interpreter = new HepsiJetResponseInterpreter();
                break;

            case ResourceName.TSoft:
                interpreter = new TSoftResponseInterpreter();
                break;

            // Diğer platform'lar için ileride eklenebilir
            case ResourceName.Amazon:
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
