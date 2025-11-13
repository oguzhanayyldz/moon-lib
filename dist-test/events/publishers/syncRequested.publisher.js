"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncRequestedPublisher = void 0;
const common_1 = require("../../common");
const logger_service_1 = require("../../services/logger.service");
/**
 * Sync Requested Publisher
 * Manuel veya otomatik sync tetiklendiğinde kullanılır
 */
class SyncRequestedPublisher extends common_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = common_1.Subjects.SyncRequested;
    }
    async publish(data) {
        const maxRetries = 3;
        const retryDelay = 500;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger_service_1.logger.info(`✅ SyncRequested published: ${data.entityType}/${data.entityId} by ${data.requestedBy}`);
                return;
            }
            catch (error) {
                if (attempt === maxRetries) {
                    logger_service_1.logger.error('❌ Failed to publish SyncRequested event:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.SyncRequestedPublisher = SyncRequestedPublisher;
//# sourceMappingURL=syncRequested.publisher.js.map