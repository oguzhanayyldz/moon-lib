export enum Subjects {
    ProductCreated = "product:created",
    ProductUpdated = "product:updated",
    ProductIntegrationCreated = "product:integration:created",
    ProductIntegrationSynced = "product:integration:synced",
    ProductStockCreated = "product:stock:created",
    ProductStockUpdated = "product:stock:updated",
    // === DEPRECATED (issue #507) — Standalone route'lar dead, listener'lar kaldırıldı ===
    // Bu event'ler artık hiçbir servis tarafından dinlenmiyor.
    // Product create/update flow'u bu bilgileri ProductCreated/ProductUpdated payload'ına embed ediyor.
    /** @deprecated Listener yok — ProductCreated/ProductUpdated kullanılıyor */
    CombinationCreated = "combination:created",
    /** @deprecated Listener yok — ProductCreated/ProductUpdated kullanılıyor */
    CombinationUpdated = "combination:updated",
    /** @deprecated Listener yok — ProductCreated/ProductUpdated kullanılıyor */
    PackageProductLinkCreated = "package:product:link:created",
    /** @deprecated Listener yok — ProductCreated/ProductUpdated kullanılıyor */
    PackageProductLinkUpdated = "package:product:link:updated",
    /** @deprecated Listener yok — ProductCreated/ProductUpdated kullanılıyor */
    RelationProductLinkCreated = "relation:product:link:created",
    /** @deprecated Listener yok — ProductCreated/ProductUpdated kullanılıyor */
    RelationProductLinkUpdated = "relation:product:link:updated",
    UserCreated = "user:created",
    UserUpdated = "user:updated",
    UserConfigUpdated = "user:config:updated",
    StockCreated = "stock:created",
    StockUpdated = "stock:updated",
    OrderCreated = "order:created",
    OrderUpdated = "order:updated",
    OrderProductUpdated = "order:product:updated",
    OrderStatusUpdated = "order:status:updated",
    OrderIntegrationCreated = "order:integration:created",
    IntegrationCommand = "integration:command",
    IntegrationCommandResult = "integration:command:result",
    EntityDeleted = "entity:deleted",
    ImportImagesFromUrls = 'cdn:import-images-from-urls',
    ImportImagesFromUrlsCompleted = 'cdn:import-images-from-urls-completed',
    DeleteProductImages = 'cdn:delete-product-images',
    DeleteProductImagesCompleted = 'cdn:delete-product-images-completed',
    ProductPriceIntegrationUpdated = "product:price:integration:updated",
    ProductPriceUpdated = "product:price:updated",
    ProductStockIntegrationUpdated = "product:stock:integration:updated",
    ProductImageIntegrationUpdated = "product:image:integration:updated",
    ProductErpIdUpdated = "product:erp-id:updated",
    CatalogMappingCreated = 'catalog.mapping.created',
    IntegrationCreated = 'integration.created',
    IntegrationUpdated = 'integration.updated',
    UserIntegrationSettings = 'user.integration.settings',
    OrderIntegrationStatusUpdated = "order:integration:status:updated",
    ProductMatched = "order:product:matched",
    NotificationCreated = "notification:created",
    EntityVersionUpdated = "entity:version-updated",
    EntityVersionBulkUpdated = "entity:version-bulk-updated",
    SyncRequested = "sync:requested",
    InvoiceCreated = "invoice:created",
    InvoiceUpdated = "invoice:updated",
    InvoiceFormalized = "invoice:formalized",
    InvoiceFailed = "invoice:failed",
    /** @deprecated Listener yok — publish ediliyor ama kimse dinlemiyor */
    OrderCargoUpdated = "order:cargo:updated",
    ShipmentCreated = "shipment:created",
    ShipmentUpdated = "shipment:updated",
    ExcelFileGenerated = "excel:file:generated",
    ExcelFileStored = "excel:file:stored",
    PlatformCategorySynced = "platform:category:synced",
    PlatformBrandSynced = "platform:brand:synced",
    CategoryCreated = "category:created",
    CategoryUpdated = "category:updated",
    BrandCreated = "brand:created",
    BrandUpdated = "brand:updated",
    /** @deprecated Publisher yok — hiçbir servis bu event'i publish etmiyor */
    CustomerCreated = "customer:created",
    CustomerUpdated = "customer:updated",
    /** @deprecated Publisher yok — hiçbir servis bu event'i publish etmiyor */
    CustomerAddressCreated = "customer:address:created",
    CustomerAddressUpdated = "customer:address:updated",
    CatalogMappingUpdated = "catalog:mapping:updated",
    UpdateOrderCargoLabel = "update:order:cargo:label",

    // Order WorkPackage Info Bulk Event (Inventory → Orders)
    OrderWorkPackageInfoBulkUpdated = "order:workpackage-info:bulk-updated",

    // Price Processing
    PriceProcessingCompleted = "price:processing:completed",

    // Subscription Events
    SubscriptionUpdated = "subscription:updated",
    SubscriptionPaymentCompleted = "subscription:payment:completed",
    /** @deprecated Listener yok — publish ediliyor ama kimse dinlemiyor */
    SubscriptionPaymentFailed = "subscription:payment:failed",
    /** @deprecated Listener yok — publish ediliyor ama kimse dinlemiyor */
    SubscriptionInvoiceCreated = "subscription:invoice:created",
}
