"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketplaceSettlementsFetchedPublisher = void 0;
const common_1 = require("../../common");
const logger_service_1 = require("../../services/logger.service");
/**
 * Pazaryeri hakedis kayitlari publisher'i (UC-1688).
 * OrderProductCostAssignedPublisher ile ayni retry davranisi.
 */
class MarketplaceSettlementsFetchedPublisher extends common_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = common_1.Subjects.MarketplaceSettlementsFetched;
    }
    async publish(data) {
        const maxRetries = 5;
        const retryDelay = 1000;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                return;
            }
            catch (error) {
                if (attempt === maxRetries) {
                    logger_service_1.logger.error('Failed to publish MarketplaceSettlementsFetched event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.MarketplaceSettlementsFetchedPublisher = MarketplaceSettlementsFetchedPublisher;
//# sourceMappingURL=marketplaceSettlementsFetched.publisher.js.map