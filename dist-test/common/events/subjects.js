"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Subjects = void 0;
var Subjects;
(function (Subjects) {
    Subjects["ProductCreated"] = "product:created";
    Subjects["ProductUpdated"] = "product:updated";
    Subjects["ProductIntegrationCreated"] = "product:integration:created";
    Subjects["ProductIntegrationSynced"] = "product:integration:synced";
    Subjects["ProductStockCreated"] = "product:stock:created";
    Subjects["ProductStockUpdated"] = "product:stock:updated";
    // === DEPRECATED (issue #507) — Standalone route'lar dead, listener'lar kaldırıldı ===
    // Bu event'ler artık hiçbir servis tarafından dinlenmiyor.
    // Product create/update flow'u bu bilgileri ProductCreated/ProductUpdated payload'ına embed ediyor.
    /** @deprecated Listener yok — ProductCreated/ProductUpdated kullanılıyor */
    Subjects["CombinationCreated"] = "combination:created";
    /** @deprecated Listener yok — ProductCreated/ProductUpdated kullanılıyor */
    Subjects["CombinationUpdated"] = "combination:updated";
    /** @deprecated Listener yok — ProductCreated/ProductUpdated kullanılıyor */
    Subjects["PackageProductLinkCreated"] = "package:product:link:created";
    /** @deprecated Listener yok — ProductCreated/ProductUpdated kullanılıyor */
    Subjects["PackageProductLinkUpdated"] = "package:product:link:updated";
    /** @deprecated Listener yok — ProductCreated/ProductUpdated kullanılıyor */
    Subjects["RelationProductLinkCreated"] = "relation:product:link:created";
    /** @deprecated Listener yok — ProductCreated/ProductUpdated kullanılıyor */
    Subjects["RelationProductLinkUpdated"] = "relation:product:link:updated";
    Subjects["UserCreated"] = "user:created";
    Subjects["UserUpdated"] = "user:updated";
    Subjects["UserConfigUpdated"] = "user:config:updated";
    Subjects["StockCreated"] = "stock:created";
    Subjects["StockUpdated"] = "stock:updated";
    Subjects["OrderCreated"] = "order:created";
    Subjects["OrderUpdated"] = "order:updated";
    Subjects["OrderProductUpdated"] = "order:product:updated";
    Subjects["OrderStatusUpdated"] = "order:status:updated";
    Subjects["OrderIntegrationCreated"] = "order:integration:created";
    Subjects["IntegrationCommand"] = "integration:command";
    Subjects["IntegrationCommandResult"] = "integration:command:result";
    Subjects["EntityDeleted"] = "entity:deleted";
    Subjects["ImportImagesFromUrls"] = "cdn:import-images-from-urls";
    Subjects["ImportImagesFromUrlsCompleted"] = "cdn:import-images-from-urls-completed";
    Subjects["DeleteProductImages"] = "cdn:delete-product-images";
    Subjects["DeleteProductImagesCompleted"] = "cdn:delete-product-images-completed";
    Subjects["ProductPriceIntegrationUpdated"] = "product:price:integration:updated";
    Subjects["ProductPriceUpdated"] = "product:price:updated";
    Subjects["ProductStockIntegrationUpdated"] = "product:stock:integration:updated";
    Subjects["ProductImageIntegrationUpdated"] = "product:image:integration:updated";
    Subjects["ProductErpIdUpdated"] = "product:erp-id:updated";
    Subjects["CatalogMappingCreated"] = "catalog.mapping.created";
    Subjects["IntegrationCreated"] = "integration.created";
    Subjects["IntegrationUpdated"] = "integration.updated";
    Subjects["UserIntegrationSettings"] = "user.integration.settings";
    Subjects["OrderIntegrationStatusUpdated"] = "order:integration:status:updated";
    Subjects["ProductMatched"] = "order:product:matched";
    Subjects["NotificationCreated"] = "notification:created";
    Subjects["EntityVersionUpdated"] = "entity:version-updated";
    Subjects["EntityVersionBulkUpdated"] = "entity:version-bulk-updated";
    Subjects["SyncRequested"] = "sync:requested";
    Subjects["InvoiceCreated"] = "invoice:created";
    Subjects["InvoiceUpdated"] = "invoice:updated";
    Subjects["InvoiceFormalized"] = "invoice:formalized";
    Subjects["InvoiceFailed"] = "invoice:failed";
    /** @deprecated Listener yok — publish ediliyor ama kimse dinlemiyor */
    Subjects["OrderCargoUpdated"] = "order:cargo:updated";
    Subjects["ShipmentCreated"] = "shipment:created";
    Subjects["ShipmentUpdated"] = "shipment:updated";
    Subjects["ExcelFileGenerated"] = "excel:file:generated";
    Subjects["ExcelFileStored"] = "excel:file:stored";
    Subjects["PlatformCategorySynced"] = "platform:category:synced";
    Subjects["PlatformBrandSynced"] = "platform:brand:synced";
    Subjects["CategoryCreated"] = "category:created";
    Subjects["CategoryUpdated"] = "category:updated";
    Subjects["BrandCreated"] = "brand:created";
    Subjects["BrandUpdated"] = "brand:updated";
    /** @deprecated Publisher yok — hiçbir servis bu event'i publish etmiyor */
    Subjects["CustomerCreated"] = "customer:created";
    Subjects["CustomerUpdated"] = "customer:updated";
    /** @deprecated Publisher yok — hiçbir servis bu event'i publish etmiyor */
    Subjects["CustomerAddressCreated"] = "customer:address:created";
    Subjects["CustomerAddressUpdated"] = "customer:address:updated";
    Subjects["CatalogMappingUpdated"] = "catalog:mapping:updated";
    Subjects["UpdateOrderCargoLabel"] = "update:order:cargo:label";
    // Order WorkPackage Info Bulk Event (Inventory → Orders)
    Subjects["OrderWorkPackageInfoBulkUpdated"] = "order:workpackage-info:bulk-updated";
    // Price Processing
    Subjects["PriceProcessingCompleted"] = "price:processing:completed";
    // Subscription Events
    Subjects["SubscriptionUpdated"] = "subscription:updated";
    Subjects["SubscriptionPaymentCompleted"] = "subscription:payment:completed";
    /** @deprecated Listener yok — publish ediliyor ama kimse dinlemiyor */
    Subjects["SubscriptionPaymentFailed"] = "subscription:payment:failed";
    /** @deprecated Listener yok — publish ediliyor ama kimse dinlemiyor */
    Subjects["SubscriptionInvoiceCreated"] = "subscription:invoice:created";
})(Subjects || (exports.Subjects = Subjects = {}));
//# sourceMappingURL=subjects.js.map