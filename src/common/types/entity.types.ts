/**
 * Entity Types
 * Microservices'lerde kullanılan entity tipleri
 */
export enum EntityType {
  Product = 'product',
  Combination = 'combination',
  PackageProductLink = 'package-product-link',
  RelationProductLink = 'relation-product-link',
  Order = 'order',
  OrderProduct = 'order-product',
  Customer = 'customer',
  CustomerAddress = 'customer-address',
  Stock = 'stock',
  User = 'user',
  Integration = 'integration',
  Invoice = 'invoice',
  Shipment = 'shipment',
}

/**
 * Service Names
 * Microservices isimleri
 */
export enum ServiceName {
  Products = 'products',
  Orders = 'orders',
  Inventory = 'inventory',
  Pricing = 'pricing',
  Catalog = 'catalog',
  Sync = 'sync',
  Invoice = 'invoice',
  Shipment = 'shipment',
}
