"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeModelsForIntegration = exports.initializeModels = void 0;
const outbox_schema_1 = require("./models/outbox.schema");
const deadLetter_schema_1 = require("./models/deadLetter.schema");
const integrationCategory_schema_1 = require("./models/integrationCategory.schema");
const integrationBrand_schema_1 = require("./models/integrationBrand.schema");
const integrationCategoryAttributes_schema_1 = require("./models/integrationCategoryAttributes.schema");
const integrationRequestLog_schema_1 = require("./models/integrationRequestLog.schema");
// Models
__exportStar(require("./models/base/base.schema"), exports);
__exportStar(require("./models/outbox.schema"), exports);
__exportStar(require("./models/deadLetter.schema"), exports);
__exportStar(require("./models/integrationCategory.schema"), exports);
__exportStar(require("./models/integrationBrand.schema"), exports);
__exportStar(require("./models/integrationCategoryAttributes.schema"), exports);
__exportStar(require("./models/integrationRequestLog.schema"), exports);
// Services
__exportStar(require("./services/natsWrapper.service"), exports);
__exportStar(require("./services/tracer.service"), exports);
__exportStar(require("./services/redisWrapper.service"), exports);
__exportStar(require("./services/retryManager"), exports);
__exportStar(require("./services/logger.service"), exports);
__exportStar(require("./services/integrationRouter.service"), exports);
__exportStar(require("./services/integrationRequestLog.service"), exports);
// Security
__exportStar(require("./security/SecurityValidator"), exports);
__exportStar(require("./security/RateLimiter"), exports);
__exportStar(require("./security/BruteForceProtection"), exports);
__exportStar(require("./security/SecurityHeaders"), exports);
__exportStar(require("./security/SecurityManager"), exports);
__exportStar(require("./security/CSRFService"), exports);
__exportStar(require("./security/MicroserviceSecurityService"), exports);
// Utils
__exportStar(require("./utils/optimisticLocking.util"), exports);
__exportStar(require("./utils/typeGuards.util"), exports);
// Jobs
__exportStar(require("./jobs/eventPublisher.job"), exports);
__exportStar(require("./jobs/deadLetterProcessor.job"), exports);
// Events
__exportStar(require("./events/publishers/userCreated.publisher"), exports);
__exportStar(require("./events/publishers/userUpdated.publisher"), exports);
__exportStar(require("./events/publishers/productCreated.publisher"), exports);
__exportStar(require("./events/publishers/productUpdated.publisher"), exports);
__exportStar(require("./events/publishers/productIntegrationCreated.publisher"), exports);
__exportStar(require("./events/publishers/productIntegrationSynced.publisher"), exports);
__exportStar(require("./events/publishers/combinationCreated.publisher"), exports);
__exportStar(require("./events/publishers/combinationUpdated.publisher"), exports);
__exportStar(require("./events/publishers/packageProductLinkCreated.publisher"), exports);
__exportStar(require("./events/publishers/packageProductLinkUpdated.publisher"), exports);
__exportStar(require("./events/publishers/relationProductLinkCreated.publisher"), exports);
__exportStar(require("./events/publishers/relationProductLinkUpdated.publisher"), exports);
__exportStar(require("./events/publishers/integrationCommand.publisher"), exports);
__exportStar(require("./events/publishers/integrationCommandResult.publisher"), exports);
__exportStar(require("./events/publishers/productStockCreated.publisher"), exports);
__exportStar(require("./events/publishers/productStockUpdated.publisher"), exports);
__exportStar(require("./events/publishers/stockCreated.publisher"), exports);
__exportStar(require("./events/publishers/stockUpdated.publisher"), exports);
__exportStar(require("./events/publishers/orderCreated.publisher"), exports);
__exportStar(require("./events/publishers/orderUpdated.publisher"), exports);
__exportStar(require("./events/publishers/orderStatusUpdated.publisher"), exports);
__exportStar(require("./events/retryableListener"), exports);
__exportStar(require("./events/publishers/deleteProductImagesCompletedPublisher.publisher"), exports);
__exportStar(require("./events/publishers/deleteProductImagesPublisher.publisher"), exports);
__exportStar(require("./events/publishers/importImagesFromUrlsCompletedPublisher.publisher"), exports);
__exportStar(require("./events/publishers/importImagesFromUrlsPublisher.publisher"), exports);
__exportStar(require("./events/publishers/productPriceIntegrationUpdated.publisher"), exports);
__exportStar(require("./events/publishers/productPriceUpdated.publisher"), exports);
__exportStar(require("./events/publishers/productStockIntegrationUpdated.publisher"), exports);
__exportStar(require("./events/publishers/productImageIntegrationUpdated.publisher"), exports);
__exportStar(require("./events/publishers/catalogMappingCreated.publisher"), exports);
__exportStar(require("./events/publishers/orderIntegrationCreated.publisher"), exports);
__exportStar(require("./events/retryableListener"), exports);
__exportStar(require("./events/publishers/integrationCreated.publisher"), exports);
__exportStar(require("./events/publishers/userIntegrationSettings.publisher"), exports);
__exportStar(require("./events/publishers/orderIntegrationStatusUpdated.publisher"), exports);
// 🚀 Complete Common Utilities (replaces @xmoonx/common functionality)
// Error Handling - Complete Set
__exportStar(require("./common/"), exports);
// Model başlatma fonksiyonu
const initializeModels = (connection) => {
    (0, outbox_schema_1.createOutboxModel)(connection);
    (0, deadLetter_schema_1.createDeadLetterModel)(connection);
};
exports.initializeModels = initializeModels;
const initializeModelsForIntegration = (connection) => {
    (0, outbox_schema_1.createOutboxModel)(connection);
    (0, deadLetter_schema_1.createDeadLetterModel)(connection);
    (0, integrationCategory_schema_1.createIntegrationCategoryModel)(connection);
    (0, integrationBrand_schema_1.createIntegrationBrandModel)(connection);
    (0, integrationCategoryAttributes_schema_1.createIntegrationCategoryAttributesModel)(connection);
    (0, integrationRequestLog_schema_1.createIntegrationRequestLogModel)(connection);
};
exports.initializeModelsForIntegration = initializeModelsForIntegration;
//# sourceMappingURL=index.js.map