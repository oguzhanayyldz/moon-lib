"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerAddressUpdatedPublisher = void 0;
const common_1 = require("../../common");
const logger_service_1 = require("../../services/logger.service");
class CustomerAddressUpdatedPublisher extends common_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = common_1.Subjects.CustomerAddressUpdated;
    }
    async publish(data) {
        const maxRetries = 5;
        const retryDelay = 1000; // 1 saniye
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                return;
            }
            catch (error) {
                if (attempt === maxRetries) {
                    logger_service_1.logger.error('Failed to publish CustomerAddressUpdated event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.CustomerAddressUpdatedPublisher = CustomerAddressUpdatedPublisher;
//# sourceMappingURL=customerAddressUpdated.publisher.js.map