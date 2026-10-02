"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductPreMatchUpdatedPublisher = void 0;
const common_1 = require("../../common");
const logger_service_1 = require("../../services/logger.service");
/**
 * ProductPreMatchUpdated Publisher (TASK-MURHHI9UCDMZW)
 *
 * Entegrasyon servisleri "Eşleşen" ürünlerin eşleşme verisini ve karar durumunu catalog'a
 * geri beslerken bu publisher'ı kullanır. IntegrationCommandResultPublisher ile
 * aynı retry stratejisini izler.
 */
class ProductPreMatchUpdatedPublisher extends common_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = common_1.Subjects.ProductPreMatchUpdated;
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
                    logger_service_1.logger.error('Failed to publish ProductPreMatchUpdated event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.ProductPreMatchUpdatedPublisher = ProductPreMatchUpdatedPublisher;
//# sourceMappingURL=productPreMatchUpdated.publisher.js.map