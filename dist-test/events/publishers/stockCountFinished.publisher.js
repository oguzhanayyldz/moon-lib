"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockCountFinishedPublisher = void 0;
const common_1 = require("../../common");
const logger_service_1 = require("../../services/logger.service");
/**
 * Depo sayımı bitti publisher'ı (issue #637)
 *
 * Bu event kaybolursa kilit tüketici tarafta `expiresAt` dolana kadar açık
 * kalır — bu yüzden retry uygulanır, ancak defensive expiry ikinci savunma
 * hattı olarak her koşulda devrededir.
 */
class StockCountFinishedPublisher extends common_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = common_1.Subjects.StockCountFinished;
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
                    logger_service_1.logger.error('Failed to publish StockCountFinished event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.StockCountFinishedPublisher = StockCountFinishedPublisher;
//# sourceMappingURL=stockCountFinished.publisher.js.map