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
    // Combination/PPL/RPL event'leri tamamen kaldırıldı (issue #507)
    // ProductCreated/ProductUpdated payload'ında embed ediliyor
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
    // OrderCargoUpdated tamamen kaldırıldı (issue #507)
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
    // CustomerCreated/CustomerAddressCreated tamamen kaldırıldı (issue #507) — publisher yok
    Subjects["CustomerUpdated"] = "customer:updated";
    Subjects["CustomerAddressUpdated"] = "customer:address:updated";
    Subjects["CatalogMappingUpdated"] = "catalog:mapping:updated";
    Subjects["UpdateOrderCargoLabel"] = "update:order:cargo:label";
    // Order WorkPackage Info Bulk Event (Inventory → Orders)
    Subjects["OrderWorkPackageInfoBulkUpdated"] = "order:workpackage-info:bulk-updated";
    // Price Processing
    Subjects["PriceProcessingCompleted"] = "price:processing:completed";
    // Integration Auth Failure (issue #521)
    Subjects["IntegrationAuthFailureExceeded"] = "integration:auth-failure:exceeded";
    // Subscription Events
    Subjects["SubscriptionUpdated"] = "subscription:updated";
    Subjects["SubscriptionPaymentCompleted"] = "subscription:payment:completed";
    /**
     * RESERVED — bilinçli olarak tutuluyor, SİLME! (bkz. issue #586 kapanış notu)
     * Şu an producer/listener yok; gelecekteki abonelik ödeme akışı için rezerve.
     * Mevcut davranış: SubscriptionService.publishPaymentFailed sadece bildirim atar.
     */
    Subjects["SubscriptionPaymentFailed"] = "subscription:payment:failed";
    /**
     * RESERVED — bilinçli olarak tutuluyor, SİLME! (bkz. issue #586 kapanış notu)
     * Şu an producer/listener yok; gelecekteki abonelik faturalandırma akışının
     * downstream tüketicileri (muhasebe, raporlama) için rezerve.
     */
    Subjects["SubscriptionInvoiceCreated"] = "subscription:invoice:created";
    // Stock Update Confirmation (issue #567)
    // Entegrasyon → catalog: stok platforma GERÇEKTEN yazıldı teyidi (async batch/sync sonucu)
    Subjects["StockUpdateConfirmed"] = "stock:update:confirmed";
    // Depo sayimi (issue #637)
    // inventory → integration + orders: sayim basladi/bitti.
    // Kilit paylasilan Redis anahtariyla TASINAMAZ — Redis her serviste izole
    // (inventory `/6`, integration `/0`, ayri secret'lar). Tek guvenilir yol NATS.
    Subjects["StockCountStarted"] = "stock:count:started";
    Subjects["StockCountFinished"] = "stock:count:finished";
    // Urun maliyeti guncellendi (issue #638)
    // inventory -> pricing: alis faturasi hareketli ortalama maliyeti degistirdi,
    // pricing bunu Price.costPrice'a yazar. Maliyet hesabi inventory'de yapilir cunku
    // formulun "mevcut stok" girdisi ProductStock'tur (inventory NATIVE) — pricing
    // oraya erisemez (Kural 2).
    Subjects["ProductCostUpdated"] = "product:cost:updated";
    // Siparis kaleminin maliyeti ATANDI (issue #683, epic #677 Faz C).
    // Yayinlayan: inventory — rezervasyon aninda maliyet katmanlari tuketilir ve
    // tuketilen agirlikli birim maliyet bu event ile orders'a tasinir.
    // Dinleyen: orders (OrderProduct.costPrice/costTotal/costSource yazar)
    //
    // NEDEN AYRI EVENT: maliyet inventory'de hesaplanir (katmanlar orada NATIVE'dir),
    // ama siparis kalemi orders'a aittir. Kural 2 geregi inventory oraya yazamaz.
    Subjects["OrderProductCostAssigned"] = "order:product:cost:assigned";
    // Newsletter (issue #611)
    // auth → notification: bulten abonesine tek bir mail gonderilecek.
    // NotificationCreated YENIDEN KULLANILMADI: onun payload'i userId zorunlu kilar ve
    // listener bunu dedupe key'i olarak kullanir; bulten abonesi User DEGILDIR.
    Subjects["NewsletterEmailRequested"] = "newsletter:email:requested";
})(Subjects || (exports.Subjects = Subjects = {}));
