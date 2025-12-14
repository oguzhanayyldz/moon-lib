"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrandUpdatedPublisher = void 0;
const events_1 = require("../../common/events");
const logger_service_1 = require("../../services/logger.service");
/**
 * Brand Updated Event Publisher
 * Publishes brand update events from products service
 */
class BrandUpdatedPublisher extends events_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = events_1.Subjects.BrandUpdated;
    }
    async publish(data) {
        const maxRetries = 5;
        const retryDelay = 1000;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger_service_1.logger.info(`Brand updated event published: ${data.name} (ID: ${data.id})`);
                return;
            }
            catch (error) {
                if (attempt === maxRetries) {
                    logger_service_1.logger.error(`Failed to publish brand updated event after ${maxRetries} retries:`, error);
                    throw error;
                }
                logger_service_1.logger.warn(`Retry attempt ${attempt} for brand updated event`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.BrandUpdatedPublisher = BrandUpdatedPublisher;
//# sourceMappingURL=brandUpdated.publisher.js.map