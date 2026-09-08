"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderProductCostAssignedPublisher = void 0;
const common_1 = require("../../common");
const logger_service_1 = require("../../services/logger.service");
/**
 * Siparis kalemi maliyet atama publisher'i (issue #683)
 * ProductCostUpdatedPublisher ile ayni retry davranisi.
 */
class OrderProductCostAssignedPublisher extends common_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = common_1.Subjects.OrderProductCostAssigned;
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
                    logger_service_1.logger.error('Failed to publish OrderProductCostAssigned event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.OrderProductCostAssignedPublisher = OrderProductCostAssignedPublisher;
//# sourceMappingURL=orderProductCostAssigned.publisher.js.map