"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductPriceIntegrationFetchedPublisher = void 0;
const common_1 = require("../../common");
/** UC-2595 (B4): ERP fiyat sayfası (ham, KDV dahil) → integration `ProductPriceIntegrationFetchedListener`. */
class ProductPriceIntegrationFetchedPublisher extends common_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = common_1.Subjects.ProductPriceIntegrationFetched;
    }
}
exports.ProductPriceIntegrationFetchedPublisher = ProductPriceIntegrationFetchedPublisher;
