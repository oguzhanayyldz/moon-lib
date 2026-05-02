"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductStockBulkUpdatedPublisher = void 0;
const common_1 = require("../../common");
const logger_service_1 = require("../../services/logger.service");
class ProductStockBulkUpdatedPublisher extends common_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = common_1.Subjects.ProductStockBulkUpdated;
    }
    async publish(data) {
        var _a;
        const maxRetries = 5;
        const retryDelay = 1000;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger_service_1.logger.info(`✅ ProductStockBulkUpdated published: ${data.items.length} items, source=${(_a = data.source) !== null && _a !== void 0 ? _a : 'n/a'} (requestId=${data.requestId})`);
                return;
            }
            catch (error) {
                if (attempt === maxRetries) {
                    logger_service_1.logger.error('❌ Failed to publish ProductStockBulkUpdated event:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.ProductStockBulkUpdatedPublisher = ProductStockBulkUpdatedPublisher;
//# sourceMappingURL=productStockBulkUpdated.publisher.js.map