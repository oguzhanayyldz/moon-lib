"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderWorkPackageInfoBulkUpdatedPublisher = void 0;
const common_1 = require("../../common");
const logger_service_1 = require("../../services/logger.service");
class OrderWorkPackageInfoBulkUpdatedPublisher extends common_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = common_1.Subjects.OrderWorkPackageInfoBulkUpdated;
    }
    async publish(data) {
        const maxRetries = 5;
        const retryDelay = 1000;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger_service_1.logger.info(`OrderWorkPackageInfoBulkUpdated event published`, {
                    workPackageId: data.workPackageId,
                    batchId: data.batchId,
                    batchSize: data.batchSize
                });
                return;
            }
            catch (error) {
                if (attempt === maxRetries) {
                    logger_service_1.logger.error('Failed to publish OrderWorkPackageInfoBulkUpdated event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.OrderWorkPackageInfoBulkUpdatedPublisher = OrderWorkPackageInfoBulkUpdatedPublisher;
//# sourceMappingURL=orderWorkPackageInfoBulkUpdated.publisher.js.map