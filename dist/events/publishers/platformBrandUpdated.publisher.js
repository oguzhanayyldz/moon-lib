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
exports.PlatformBrandUpdatedPublisher = void 0;
const events_1 = require("../../common/events");
const logger_service_1 = require("../../services/logger.service");
/**
 * Platform Brand Updated Event Publisher
 * Publishes bulk brand update events from integration services
 */
class PlatformBrandUpdatedPublisher extends events_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = events_1.Subjects.PlatformBrandUpdated;
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
                    logger_service_1.logger.info(`Platform brands updated event published: ${data.integrationName}, ${data.brands.length} brands`);
                    return;
                }
                catch (error) {
                    if (attempt === maxRetries) {
                        logger_service_1.logger.error(`Failed to publish platform brand updated event after ${maxRetries} retries:`, error);
                        throw error;
                    }
                    logger_service_1.logger.warn(`Retry attempt ${attempt} for platform brand updated event`);
                    yield new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
                }
            }
        });
    }
}
exports.PlatformBrandUpdatedPublisher = PlatformBrandUpdatedPublisher;
