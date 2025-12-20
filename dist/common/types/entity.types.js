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
    EntityType["Customer"] = "customer";
    EntityType["CustomerAddress"] = "customer-address";
    EntityType["Stock"] = "stock";
    EntityType["User"] = "user";
    EntityType["Integration"] = "integration";
    EntityType["Invoice"] = "invoice";
    EntityType["Shipment"] = "shipment";
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
})(ServiceName || (exports.ServiceName = ServiceName = {}));
