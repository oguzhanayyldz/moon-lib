"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformBrandSyncedPublisher = void 0;
const events_1 = require("../../common/events");
const logger_service_1 = require("../../services/logger.service");
/**
 * Platform Brand Synced Event Publisher
 * Publishes bulk brand sync events from integration services
 */
class PlatformBrandSyncedPublisher extends events_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = events_1.Subjects.PlatformBrandSynced;
    }
    async publish(data) {
        const maxRetries = 5;
        const retryDelay = 1000;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger_service_1.logger.info(`Platform brands synced event published: ${data.integrationName}, ${data.brands.length} brands`);
                return;
            }
            catch (error) {
                if (attempt === maxRetries) {
                    logger_service_1.logger.error(`Failed to publish platform brand synced event after ${maxRetries} retries:`, error);
                    throw error;
                }
                logger_service_1.logger.warn(`Retry attempt ${attempt} for platform brand synced event`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.PlatformBrandSyncedPublisher = PlatformBrandSyncedPublisher;
//# sourceMappingURL=platformBrandSynced.publisher.js.map