"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionUpdatedPublisher = void 0;
const common_1 = require("../../common");
const logger_service_1 = require("../../services/logger.service");
class SubscriptionUpdatedPublisher extends common_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = common_1.Subjects.SubscriptionUpdated;
    }
    async publish(data) {
        const maxRetries = 5;
        const retryDelay = 1000;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger_service_1.logger.info(`[SubscriptionUpdatedPublisher] Published subscription ${data.action} for user ${data.userId}`);
                return;
            }
            catch (error) {
                if (attempt === maxRetries) {
                    logger_service_1.logger.error('[SubscriptionUpdatedPublisher] Failed to publish event after retries:', error);
                    throw error;
                }
                logger_service_1.logger.warn(`[SubscriptionUpdatedPublisher] Retry attempt ${attempt}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.SubscriptionUpdatedPublisher = SubscriptionUpdatedPublisher;
//# sourceMappingURL=subscriptionUpdated.publisher.js.map