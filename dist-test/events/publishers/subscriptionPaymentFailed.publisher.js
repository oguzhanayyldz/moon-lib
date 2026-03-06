"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionPaymentFailedPublisher = void 0;
const common_1 = require("../../common");
const logger_service_1 = require("../../services/logger.service");
class SubscriptionPaymentFailedPublisher extends common_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = common_1.Subjects.SubscriptionPaymentFailed;
    }
    async publish(data) {
        const maxRetries = 5;
        const retryDelay = 1000;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger_service_1.logger.info(`[SubscriptionPaymentFailedPublisher] Published payment failure ${data.paymentId} for user ${data.userId}`);
                return;
            }
            catch (error) {
                if (attempt === maxRetries) {
                    logger_service_1.logger.error('[SubscriptionPaymentFailedPublisher] Failed to publish event after retries:', error);
                    throw error;
                }
                logger_service_1.logger.warn(`[SubscriptionPaymentFailedPublisher] Retry attempt ${attempt}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.SubscriptionPaymentFailedPublisher = SubscriptionPaymentFailedPublisher;
//# sourceMappingURL=subscriptionPaymentFailed.publisher.js.map