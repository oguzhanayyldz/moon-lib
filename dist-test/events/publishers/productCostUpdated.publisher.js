"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductCostUpdatedPublisher = void 0;
const common_1 = require("../../common");
const logger_service_1 = require("../../services/logger.service");
/**
 * Urun maliyeti guncelleme publisher'i (issue #638)
 * ProductPriceUpdatedPublisher ile ayni retry davranisi.
 */
class ProductCostUpdatedPublisher extends common_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = common_1.Subjects.ProductCostUpdated;
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
                    logger_service_1.logger.error('Failed to publish ProductCostUpdated event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.ProductCostUpdatedPublisher = ProductCostUpdatedPublisher;
//# sourceMappingURL=productCostUpdated.publisher.js.map