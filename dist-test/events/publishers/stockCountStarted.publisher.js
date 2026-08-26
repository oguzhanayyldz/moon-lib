"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockCountStartedPublisher = void 0;
const common_1 = require("../../common");
const logger_service_1 = require("../../services/logger.service");
/**
 * Depo sayımı başladı publisher'ı (issue #637)
 *
 * Kilit yayılımı kritik: event ulaşmazsa tüketici servisler sipariş çekmeye
 * devam eder ve sayım sırasında stok değişir. Bu yüzden NotificationCreated
 * ile aynı retry davranışı uygulanır.
 */
class StockCountStartedPublisher extends common_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = common_1.Subjects.StockCountStarted;
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
                    logger_service_1.logger.error('Failed to publish StockCountStarted event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
exports.StockCountStartedPublisher = StockCountStartedPublisher;
//# sourceMappingURL=stockCountStarted.publisher.js.map