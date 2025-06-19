"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductPriceIntegrationUpdatedPublisher = void 0;
const common_1 = require("../../common");
const logger_service_1 = require("../../services/logger.service");
class ProductPriceIntegrationUpdatedPublisher extends common_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = common_1.Subjects.ProductPriceIntegrationUpdated;
    }
    async publish(data) {
        const maxRetries = 5;
        const retryDelay = 1000; // 1 saniye
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                return;
            }
            catch (error) {
                if (attempt === maxRetries) {
                    // Son denemede de başarısız olursa loglama yap
                    logger_service_1.logger.error('Failed to publish event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.ProductPriceIntegrationUpdatedPublisher = ProductPriceIntegrationUpdatedPublisher;
//# sourceMappingURL=productPriceIntegrationUpdated.publisher.js.map