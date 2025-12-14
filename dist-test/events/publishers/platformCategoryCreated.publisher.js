"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformCategoryCreatedPublisher = void 0;
const events_1 = require("../../common/events");
const logger_service_1 = require("../../services/logger.service");
/**
 * Platform Category Created Event Publisher
 * Publishes bulk category creation events from integration services
 */
class PlatformCategoryCreatedPublisher extends events_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = events_1.Subjects.PlatformCategoryCreated;
    }
    async publish(data) {
        const maxRetries = 5;
        const retryDelay = 1000;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger_service_1.logger.info(`Platform categories created event published: ${data.integrationName}, ${data.categories.length} categories`);
                return;
            }
            catch (error) {
                if (attempt === maxRetries) {
                    logger_service_1.logger.error(`Failed to publish platform category created event after ${maxRetries} retries:`, error);
                    throw error;
                }
                logger_service_1.logger.warn(`Retry attempt ${attempt} for platform category created event`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.PlatformCategoryCreatedPublisher = PlatformCategoryCreatedPublisher;
//# sourceMappingURL=platformCategoryCreated.publisher.js.map