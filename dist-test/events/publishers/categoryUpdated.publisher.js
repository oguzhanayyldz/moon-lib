"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryUpdatedPublisher = void 0;
const events_1 = require("../../common/events");
const logger_service_1 = require("../../services/logger.service");
/**
 * Category Updated Event Publisher
 * Publishes category update events from products service
 */
class CategoryUpdatedPublisher extends events_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = events_1.Subjects.CategoryUpdated;
    }
    async publish(data) {
        const maxRetries = 5;
        const retryDelay = 1000;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger_service_1.logger.info(`Category updated event published: ${data.categories.length} categories for user ${data.user}`);
                return;
            }
            catch (error) {
                if (attempt === maxRetries) {
                    logger_service_1.logger.error(`Failed to publish category updated event after ${maxRetries} retries:`, error);
                    throw error;
                }
                logger_service_1.logger.warn(`Retry attempt ${attempt} for category updated event`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.CategoryUpdatedPublisher = CategoryUpdatedPublisher;
//# sourceMappingURL=categoryUpdated.publisher.js.map