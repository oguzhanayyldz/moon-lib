/**
 * Entity Types
 * Microservices'lerde kullanılan entity tipleri
 */
export declare enum EntityType {
    Product = "product",
    Combination = "combination",
    PackageProductLink = "package-product-link",
    RelationProductLink = "relation-product-link",
    Order = "order",
    OrderProduct = "order-product",
    Customer = "customer",
    CustomerAddress = "customer-address",
    Stock = "stock",
    User = "user",
    Integration = "integration",
    Invoice = "invoice",
    Shipment = "shipment"
}
/**
 * Service Names
 * Microservices isimleri
 */
export declare enum ServiceName {
    Products = "products",
    Orders = "orders",
    Inventory = "inventory",
    Pricing = "pricing",
    Catalog = "catalog",
    Integration = "integration",
    Sync = "sync",
    Invoice = "invoice",
    Shipment = "shipment"
}
