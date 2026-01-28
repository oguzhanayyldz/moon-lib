import { ResourceName } from '../';

/**
 * Platformlar arası ortak ürün veri modeli
 * Bu model, farklı entegrasyon platformlarına aktarılacak ürün verilerini standartlaştırır.
 */
export interface CommonProductExport {
  // Temel ürün bilgileri
  id: string;                   // Moon sistemindeki ID
  externalId?: string;          // Entegrasyon platformundaki ID (varsa)
  name: string;                 // Ürün adı
  description?: string;         // Ürün açıklaması
  sku: string;                  // SKU kodu
  barcode?: string;             // Barkod
  
  // Kategori bilgileri
  category?: {
    name: string;
    code?: string;
  };
  
  // Fiyat bilgileri
  price: number;                // Ana fiyat
  listPrice?: number;           // Liste fiyatı (önerilen satış fiyatı)
  currency: string;             // Para birimi
  tax?: number;                 // Vergi oranı
  
  // Stok bilgileri
  stock?: number;               // Stok miktarı
  
  // Resim bilgileri
  images?: Array<{
    url: string;
    main?: boolean;             // Ana resim mi?
    order?: number;             // Sıralama
  }>;
  
  // Varyant bilgileri
  variants?: Array<{
    id: string;                 // Varyant ID
    sku: string;                // Varyant SKU
    barcode?: string;           // Varyant barkod
    price?: number;             // Varyant özel fiyatı (yoksa ana ürün fiyatı kullanılır)
    stock?: number;             // Varyant stok miktarı
    attributes: Array<{
      name: string;
      value: string;
    }>;
    images?: Array<{
      url: string;
      order?: number;
    }>;
  }>;
  
  // Platform spesifik ek alanlar
  metadata?: Record<string, any>;
}

/**
 * Ürün aktarım isteği için girdi modeli
 */
export interface ProductExportRequest {
  // Aktarılacak ürün ID'si
  productId: string;
  
  // Hedef platform
  platform: ResourceName;
  
  // İşlem türü (create, update)
  operation: 'create' | 'update';
  
  // Platform spesifik ek parametreler
  platformParams?: Record<string, any>;
}
/**
 * Platformlara fiyat güncelleme isteği modeli
 */
export interface ProductPriceUpdateRequest {
  // İşlem requestId
  requestId?: string;
  
  // Moon sistemindeki ürün ID
  productId: string;
  
  // Platform ID (entegrasyon panelindeki ürün ID'si)
  externalId: string;
  
  // Hedef platform
  platform: ResourceName;
  
  // Kullanıcı ID
  userId: string;
  
  // Güncellenecek ana ürün fiyatı (varsa)
  price?: number;
  
  // Güncellenecek liste fiyatı (varsa)
  listPrice?: number;
  
  // Varyant fiyat güncellemeleri (varsa)
  variants?: Array<{
    // Varyant ID (Moon sistemindeki combination ID)
    id: string;
    
    // Varyant platform ID (entegrasyon panelindeki varyant ID'si)
    externalId: string;
    
    // Güncellenecek varyant fiyatı
    price?: number;
    
    // Güncellenecek varyant liste fiyatı
    listPrice?: number;
  }>;
  
  // Platform spesifik ek parametreler
  platformParams?: Record<string, any>;
}

/**
 * Platformlara stok güncelleme isteği modeli
 */
export interface ProductStockUpdateRequest {
  // İşlem requestId
  requestId?: string;
  
  // Moon sistemindeki ürün ID
  productId: string;
  
  // Platform ID (entegrasyon panelindeki ürün ID'si)
  externalId: string;

  // Diğer platform ID'si (varsa)
  otherExternalId?: string;
  
  // Hedef platform
  platform: ResourceName;
  
  // Kullanıcı ID
  userId: string;
  
  // Güncellenecek ana ürün stok miktarı (varsa)
  stock?: number;
  
  // Varyant stok güncellemeleri (varsa)
  variants?: Array<{
    // Varyant ID (Moon sistemindeki combination ID)
    id: string;
    
    // Varyant platform ID (entegrasyon panelindeki varyant ID'si)
    externalId: string;
    
    // Güncellenecek varyant stok miktarı
    stock: number;
  }>;
  
  // Platform spesifik ek parametreler
  platformParams?: Record<string, any>;
}
