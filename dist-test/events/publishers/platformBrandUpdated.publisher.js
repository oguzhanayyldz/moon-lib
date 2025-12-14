"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformBrandUpdatedPublisher = void 0;
const events_1 = require("../../common/events");
const logger_service_1 = require("../../services/logger.service");
/**
 * Platform Brand Updated Event Publisher
 * Publishes bulk brand update events from integration services
 */
class PlatformBrandUpdatedPublisher extends events_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = events_1.Subjects.PlatformBrandUpdated;
    }
    async publish(data) {
        const maxRetries = 5;
        const retryDelay = 1000;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger_service_1.logger.info(`Platform brands updated event published: ${data.integrationName}, ${data.brands.length} brands`);
                return;
            }
            catch (error) {
                if (attempt === maxRetries) {
                    logger_service_1.logger.error(`Failed to publish platform brand updated event after ${maxRetries} retries:`, error);
                    throw error;
                }
                logger_service_1.logger.warn(`Retry attempt ${attempt} for platform brand updated event`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.PlatformBrandUpdatedPublisher = PlatformBrandUpdatedPublisher;
//# sourceMappingURL=platformBrandUpdated.publisher.js.map