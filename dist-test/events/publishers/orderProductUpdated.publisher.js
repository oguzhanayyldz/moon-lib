"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderProductStockUpdatedPublisher = void 0;
const common_1 = require("../../common");
const logger_service_1 = require("../../services/logger.service");
/**
 * OrderProductStockUpdated Publisher
 * OrderProduct'ların stok rezervasyon durumları güncellendiğinde bu publisher kullanılır
 */
class OrderProductStockUpdatedPublisher extends common_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = common_1.Subjects.OrderProductUpdated;
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
                    logger_service_1.logger.error('Failed to publish OrderProductUpdated event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.OrderProductStockUpdatedPublisher = OrderProductStockUpdatedPublisher;
//# sourceMappingURL=orderProductUpdated.publisher.js.map