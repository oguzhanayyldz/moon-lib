"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductErpIdUpdatedPublisher = void 0;
/**
 * ProductErpIdUpdated Event Publisher
 *
 * ERP sistemlerinden (Parasut, Logo, etc.) dönen external ID'leri yayınlar.
 *
 * Kullanım:
 * ```typescript
 * const publisher = new ProductErpIdUpdatedPublisher(natsWrapper.client);
 * await publisher.publish({
 *     requestId: uuidv4(),
 *     userId: '123',
 *     list: [
 *         { id: 'prod-1', product: 'prod-1', erpId: 'parasut-123', version: 5, source: 'Parasut', sourceTimestamp: new Date() }
 *     ]
 * });
 * ```
 */
const common_1 = require("../../common");
const logger_service_1 = require("../../services/logger.service");
class ProductErpIdUpdatedPublisher extends common_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = common_1.Subjects.ProductErpIdUpdated;
    }
    publish(data) {
        const _super = Object.create(null, {
            publish: { get: () => super.publish }
        });
        return __awaiter(this, void 0, void 0, function* () {
            const maxRetries = 5;
            const retryDelay = 1000; // 1 saniye
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    yield _super.publish.call(this, data);
                    return;
                }
                catch (error) {
                    if (attempt === maxRetries) {
                        // Son denemede de başarısız olursa loglama yap
                        logger_service_1.logger.error('Failed to publish event after retries:', error);
                        throw error;
                    }
                    yield new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
                }
            }
        });
    }
}
exports.ProductErpIdUpdatedPublisher = ProductErpIdUpdatedPublisher;
