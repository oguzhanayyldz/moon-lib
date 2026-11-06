"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationCommandPublisher = void 0;
const common_1 = require("../../common");
const logger_service_1 = require("../../services/logger.service");
const commandCredentials_util_1 = require("../../utils/commandCredentials.util");
class IntegrationCommandPublisher extends common_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = common_1.Subjects.IntegrationCommand;
    }
    async publish(data) {
        // UC-1408: STAN deposuna (14 gün) düz credential / User PII yazılmasın.
        // Outbox'tan gelen (zaten mühürlü) ya da eski düz kayıtların replay'i için idempotent.
        const safeData = (0, commandCredentials_util_1.sealIntegrationCommandData)(data);
        const maxRetries = 5;
        const retryDelay = 1000; // 1 saniye
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(safeData);
                return;
            }
            catch (error) {
                if (attempt === maxRetries) {
                    // Son denemede de başarısız olursa loglama yap
                    logger_service_1.logger.error('Failed to publish event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.IntegrationCommandPublisher = IntegrationCommandPublisher;
//# sourceMappingURL=integrationCommand.publisher.js.map