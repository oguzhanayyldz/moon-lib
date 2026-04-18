"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationAuthFailureExceededPublisher = void 0;
const common_1 = require("../../common");
const logger_service_1 = require("../../services/logger.service");
class IntegrationAuthFailureExceededPublisher extends common_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = common_1.Subjects.IntegrationAuthFailureExceeded;
    }
    async publish(data) {
        const maxRetries = 5;
        const retryDelay = 1000;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger_service_1.logger.info(`[IntegrationAuthFailureExceededPublisher] Published for user ${data.userId}, integration ${data.integrationName}, count ${data.failureCount}`);
                return;
            }
            catch (error) {
                if (attempt === maxRetries) {
                    logger_service_1.logger.error('[IntegrationAuthFailureExceededPublisher] Failed to publish event after retries:', error);
                    throw error;
                }
                logger_service_1.logger.warn(`[IntegrationAuthFailureExceededPublisher] Retry attempt ${attempt}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.IntegrationAuthFailureExceededPublisher = IntegrationAuthFailureExceededPublisher;
//# sourceMappingURL=integrationAuthFailureExceeded.publisher.js.map