"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSessionsRevokedPublisher = void 0;
const common_1 = require("../../common");
const logger_service_1 = require("../../services/logger.service");
/**
 * Hesap duzeyinde oturum iptali publisher'i (TASK-MUFJ7F2IFKC77)
 * NotificationCreatedPublisher ile ayni retry davranisi.
 */
class UserSessionsRevokedPublisher extends common_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = common_1.Subjects.UserSessionsRevoked;
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
                    logger_service_1.logger.error('Failed to publish UserSessionsRevoked event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.UserSessionsRevokedPublisher = UserSessionsRevokedPublisher;
//# sourceMappingURL=userSessionsRevoked.publisher.js.map