"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseInterpreterFactory = void 0;
const common_1 = require("../../common");
const trendyol_interpreter_1 = require("./trendyol.interpreter");
const shopify_interpreter_1 = require("./shopify.interpreter");
const logger_service_1 = require("../logger.service");
/**
 * Response Interpreter Factory
 * Platform'a göre uygun interpreter instance'ını döndürür
 */
class ResponseInterpreterFactory {
    /**
     * Platform'a göre interpreter döndür
     */
    static getInterpreter(integrationName) {
        // Cache'den kontrol et
        if (this.interpreters.has(integrationName)) {
            return this.interpreters.get(integrationName);
        }
        // Yeni interpreter oluştur
        let interpreter = null;
        switch (integrationName) {
            case common_1.ResourceName.Trendyol:
                interpreter = new trendyol_interpreter_1.TrendyolResponseInterpreter();
                break;
            case common_1.ResourceName.Shopify:
                interpreter = new shopify_interpreter_1.ShopifyResponseInterpreter();
                break;
            // Diğer platform'lar için ileride eklenebilir
            case common_1.ResourceName.Hepsiburada:
            case common_1.ResourceName.N11:
            case common_1.ResourceName.Amazon:
            case common_1.ResourceName.CicekSepeti:
                logger_service_1.logger.debug(`No interpreter implementation for ${integrationName} yet`);
                return null;
            default:
                logger_service_1.logger.debug(`Unknown integration name: ${integrationName}`);
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
    static clearCache() {
        this.interpreters.clear();
    }
}
exports.ResponseInterpreterFactory = ResponseInterpreterFactory;
ResponseInterpreterFactory.interpreters = new Map();
