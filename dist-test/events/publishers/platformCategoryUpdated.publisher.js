"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformCategoryUpdatedPublisher = void 0;
const events_1 = require("../../common/events");
const logger_service_1 = require("../../services/logger.service");
/**
 * Platform Category Updated Event Publisher
 * Publishes bulk category update events from integration services
 */
class PlatformCategoryUpdatedPublisher extends events_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = events_1.Subjects.PlatformCategoryUpdated;
    }
    async publish(data) {
        const maxRetries = 5;
        const retryDelay = 1000;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger_service_1.logger.info(`Platform categories updated event published: ${data.integrationName}, ${data.categories.length} categories`);
                return;
            }
            catch (error) {
                if (attempt === maxRetries) {
                    logger_service_1.logger.error(`Failed to publish platform category updated event after ${maxRetries} retries:`, error);
                    throw error;
                }
                logger_service_1.logger.warn(`Retry attempt ${attempt} for platform category updated event`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.PlatformCategoryUpdatedPublisher = PlatformCategoryUpdatedPublisher;
//# sourceMappingURL=platformCategoryUpdated.publisher.js.map