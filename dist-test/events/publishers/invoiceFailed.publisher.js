"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceFailedPublisher = void 0;
const common_1 = require("../../common");
const logger_service_1 = require("../../services/logger.service");
class InvoiceFailedPublisher extends common_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = common_1.Subjects.InvoiceFailed;
    }
    async publish(data) {
        const maxRetries = 5;
        const retryDelay = 1000; // 1 saniye
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger_service_1.logger.info(`[InvoiceFailedPublisher] Published ${data.list.length} failed invoice(s) for user ${data.userId}`);
                return;
            }
            catch (error) {
                if (attempt === maxRetries) {
                    logger_service_1.logger.error('[InvoiceFailedPublisher] Failed to publish event after retries:', error);
                    throw error;
                }
                logger_service_1.logger.warn(`[InvoiceFailedPublisher] Retry attempt ${attempt}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.InvoiceFailedPublisher = InvoiceFailedPublisher;
//# sourceMappingURL=invoiceFailed.publisher.js.map