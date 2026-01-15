"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityVersionBulkUpdatedPublisher = void 0;
const common_1 = require("../../common");
const logger_service_1 = require("../../services/logger.service");
/**
 * Entity Version Bulk Updated Publisher
 * EventPublisherJob tarafından biriktirilen EntityVersionUpdated eventlerini
 * tek bir bulk mesaj olarak publish eder
 */
class EntityVersionBulkUpdatedPublisher extends common_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = common_1.Subjects.EntityVersionBulkUpdated;
    }
    async publish(data) {
        const maxRetries = 5;
        const retryDelay = 500;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger_service_1.logger.info(`✅ EntityVersionBulkUpdated published: ${data.batchSize} updates in batch ${data.batchId}`);
                return;
            }
            catch (error) {
                if (attempt === maxRetries) {
                    logger_service_1.logger.error('❌ Failed to publish EntityVersionBulkUpdated event:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.EntityVersionBulkUpdatedPublisher = EntityVersionBulkUpdatedPublisher;
//# sourceMappingURL=entityVersionBulkUpdated.publisher.js.map