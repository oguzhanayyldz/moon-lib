"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationCreatedPublisher = void 0;
const common_1 = require("../../common");
const logger_service_1 = require("../../services/logger.service");
class NotificationCreatedPublisher extends common_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = common_1.Subjects.NotificationCreated;
    }
    async publish(data) {
        const maxRetries = 5;
        const retryDelay = 1000; // 1 second
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                return;
            }
            catch (error) {
                if (attempt === maxRetries) {
                    logger_service_1.logger.error('Failed to publish NotificationCreated event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.NotificationCreatedPublisher = NotificationCreatedPublisher;
//# sourceMappingURL=notificationCreated.publisher.js.map