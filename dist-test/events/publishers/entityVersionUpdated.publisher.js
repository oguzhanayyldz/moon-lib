"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityVersionUpdatedPublisher = void 0;
const common_1 = require("../../common");
const logger_service_1 = require("../../services/logger.service");
/**
 * Entity Version Updated Publisher
 * BaseSchema hook tarafından otomatik tetiklenir
 */
class EntityVersionUpdatedPublisher extends common_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = common_1.Subjects.EntityVersionUpdated;
    }
    async publish(data) {
        const maxRetries = 3;
        const retryDelay = 500;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger_service_1.logger.debug(`✅ EntityVersionUpdated published: ${data.entityType}/${data.entityId} v${data.version} from ${data.service}`);
                return;
            }
            catch (error) {
                if (attempt === maxRetries) {
                    logger_service_1.logger.error('❌ Failed to publish EntityVersionUpdated event:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.EntityVersionUpdatedPublisher = EntityVersionUpdatedPublisher;
//# sourceMappingURL=entityVersionUpdated.publisher.js.map