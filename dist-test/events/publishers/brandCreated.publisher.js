"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrandCreatedPublisher = void 0;
const events_1 = require("../../common/events");
const logger_service_1 = require("../../services/logger.service");
/**
 * Brand Created Event Publisher
 * Publishes brand creation events from products service
 */
class BrandCreatedPublisher extends events_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = events_1.Subjects.BrandCreated;
    }
    async publish(data) {
        const maxRetries = 5;
        const retryDelay = 1000;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger_service_1.logger.info(`Brand created event published: ${data.brands.length} brands for user ${data.user}`);
                return;
            }
            catch (error) {
                if (attempt === maxRetries) {
                    logger_service_1.logger.error(`Failed to publish brand created event after ${maxRetries} retries:`, error);
                    throw error;
                }
                logger_service_1.logger.warn(`Retry attempt ${attempt} for brand created event`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.BrandCreatedPublisher = BrandCreatedPublisher;
//# sourceMappingURL=brandCreated.publisher.js.map