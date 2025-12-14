"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryCreatedPublisher = void 0;
const events_1 = require("../../common/events");
const logger_service_1 = require("../../services/logger.service");
/**
 * Category Created Event Publisher
 * Publishes category creation events from products service
 */
class CategoryCreatedPublisher extends events_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = events_1.Subjects.CategoryCreated;
    }
    async publish(data) {
        const maxRetries = 5;
        const retryDelay = 1000;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger_service_1.logger.info(`Category created event published: ${data.categories.length} categories for user ${data.user}`);
                return;
            }
            catch (error) {
                if (attempt === maxRetries) {
                    logger_service_1.logger.error(`Failed to publish category created event after ${maxRetries} retries:`, error);
                    throw error;
                }
                logger_service_1.logger.warn(`Retry attempt ${attempt} for category created event`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.CategoryCreatedPublisher = CategoryCreatedPublisher;
//# sourceMappingURL=categoryCreated.publisher.js.map