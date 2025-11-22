"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceUpdatedPublisher = void 0;
const common_1 = require("../../common");
const logger_service_1 = require("../../services/logger.service");
class InvoiceUpdatedPublisher extends common_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = common_1.Subjects.InvoiceUpdated;
    }
    async publish(data) {
        const maxRetries = 5;
        const retryDelay = 1000; // 1 saniye
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger_service_1.logger.info(`[InvoiceUpdatedPublisher] Published ${data.list.length} invoice update(s) for user ${data.userId}`);
                return;
            }
            catch (error) {
                if (attempt === maxRetries) {
                    logger_service_1.logger.error('[InvoiceUpdatedPublisher] Failed to publish event after retries:', error);
                    throw error;
                }
                logger_service_1.logger.warn(`[InvoiceUpdatedPublisher] Retry attempt ${attempt}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.InvoiceUpdatedPublisher = InvoiceUpdatedPublisher;
//# sourceMappingURL=invoiceUpdated.publisher.js.map