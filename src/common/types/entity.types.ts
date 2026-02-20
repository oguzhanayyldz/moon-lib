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
  OrderCargo = 'order-cargo',
  Payment = 'payment',
  Customer = 'customer',
  CustomerAddress = 'customer-address',
  Stock = 'stock',
  ProductStock = 'product-stock',
  Shelf = 'shelf',
  Warehouse = 'warehouse',
  User = 'user',
  Integration = 'integration',
  UserIntegrationSettings = 'user-integration-settings',
  Invoice = 'invoice',
  Shipment = 'shipment',
  CatalogMapping = 'catalog-mapping',
  // Reporting Service Entities
  DailyMetrics = 'daily-metrics',
  HourlyMetrics = 'hourly-metrics',
  WeeklyMetrics = 'weekly-metrics',
  InventorySnapshot = 'inventory-snapshot',
  IntegrationHealth = 'integration-health',
  ReportConfig = 'report-config',
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
  Integration = 'integration',
  Sync = 'sync',
  Invoice = 'invoice',
  Shipment = 'shipment',
  Auth = 'auth',
  Notification = 'notification',
  Reporting = 'reporting',
}
