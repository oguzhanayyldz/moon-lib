"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceName = exports.EntityType = void 0;
/**
 * Entity Types
 * Microservices'lerde kullanılan entity tipleri
 */
var EntityType;
(function (EntityType) {
    EntityType["Product"] = "product";
    EntityType["Combination"] = "combination";
    EntityType["PackageProductLink"] = "package-product-link";
    EntityType["RelationProductLink"] = "relation-product-link";
    EntityType["Order"] = "order";
    EntityType["OrderProduct"] = "order-product";
    EntityType["OrderCargo"] = "order-cargo";
    EntityType["Payment"] = "payment";
    EntityType["Customer"] = "customer";
    EntityType["CustomerAddress"] = "customer-address";
    EntityType["Stock"] = "stock";
    EntityType["ProductStock"] = "product-stock";
    EntityType["Shelf"] = "shelf";
    EntityType["Warehouse"] = "warehouse";
    EntityType["User"] = "user";
    EntityType["Integration"] = "integration";
    EntityType["UserIntegrationSettings"] = "user-integration-settings";
    EntityType["Invoice"] = "invoice";
    EntityType["Shipment"] = "shipment";
    EntityType["CatalogMapping"] = "catalog-mapping";
    // Reporting Service Entities
    EntityType["DailyMetrics"] = "daily-metrics";
    EntityType["HourlyMetrics"] = "hourly-metrics";
    EntityType["WeeklyMetrics"] = "weekly-metrics";
    EntityType["InventorySnapshot"] = "inventory-snapshot";
    EntityType["IntegrationHealth"] = "integration-health";
    EntityType["ReportConfig"] = "report-config";
    // Subscription Service Entities
    EntityType["Plan"] = "plan";
    EntityType["Addon"] = "addon";
    EntityType["Subscription"] = "subscription";
    EntityType["SubscriptionPayment"] = "subscription-payment";
    EntityType["PaymentMethod"] = "payment-method";
    EntityType["UserConfig"] = "user-config";
    EntityType["Coupon"] = "coupon";
    EntityType["CouponRedemption"] = "coupon-redemption";
})(EntityType || (exports.EntityType = EntityType = {}));
/**
 * Service Names
 * Microservices isimleri
 */
var ServiceName;
(function (ServiceName) {
    ServiceName["Products"] = "products";
    ServiceName["Orders"] = "orders";
    ServiceName["Inventory"] = "inventory";
    ServiceName["Pricing"] = "pricing";
    ServiceName["Catalog"] = "catalog";
    ServiceName["Integration"] = "integration";
    ServiceName["Sync"] = "sync";
    ServiceName["Invoice"] = "invoice";
    ServiceName["Shipment"] = "shipment";
    ServiceName["Auth"] = "auth";
    ServiceName["Notification"] = "notification";
    ServiceName["Reporting"] = "reporting";
    ServiceName["Subscription"] = "subscription";
    ServiceName["Cdn"] = "cdn";
    ServiceName["Shopify"] = "shopify";
    ServiceName["Trendyol"] = "trendyol";
})(ServiceName || (exports.ServiceName = ServiceName = {}));
