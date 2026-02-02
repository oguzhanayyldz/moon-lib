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
exports.OrderWorkPackageInfoBulkUpdatedPublisher = void 0;
const common_1 = require("../../common");
const logger_service_1 = require("../../services/logger.service");
class OrderWorkPackageInfoBulkUpdatedPublisher extends common_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = common_1.Subjects.OrderWorkPackageInfoBulkUpdated;
    }
    publish(data) {
        const _super = Object.create(null, {
            publish: { get: () => super.publish }
        });
        return __awaiter(this, void 0, void 0, function* () {
            const maxRetries = 5;
            const retryDelay = 1000;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    yield _super.publish.call(this, data);
                    logger_service_1.logger.info(`OrderWorkPackageInfoBulkUpdated event published`, {
                        workPackageId: data.workPackageId,
                        batchId: data.batchId,
                        batchSize: data.batchSize
                    });
                    return;
                }
                catch (error) {
                    if (attempt === maxRetries) {
                        logger_service_1.logger.error('Failed to publish OrderWorkPackageInfoBulkUpdated event after retries:', error);
                        throw error;
                    }
                    yield new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
                }
            }
        });
    }
}
exports.OrderWorkPackageInfoBulkUpdatedPublisher = OrderWorkPackageInfoBulkUpdatedPublisher;
