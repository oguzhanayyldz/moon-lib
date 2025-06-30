# MongoDB Transaction Middleware Kullanım Rehberi

## 🎯 Genel Bakış

Transaction Middleware, MongoDB Atlas Native Transactions'ı Express route'larında otomatik olarak yönetir. Manuel session yönetimi ve transaction kontrolü yerine, sadece middleware ekleyerek ACID garantili operasyonlar gerçekleştirebilirsiniz.

## 📋 Özellikler

- ✅ **Otomatik Session Yönetimi**: Session oluşturma, commit, rollback ve cleanup
- ✅ **Context-Aware OptimisticLockingUtil**: Request'ten session otomatik algılama  
- ✅ **Error Handling**: Hata durumunda otomatik rollback
- ✅ **Performance Tracking**: Transaction süre ve performans metrikleri
- ✅ **Backward Compatibility**: Mevcut kod değişikliği gerektirmez
- ✅ **Type Safety**: TypeScript desteği ve Request interface genişletme

## 🚀 Hızlı Başlangıç

### Basit Kullanım

```typescript
import { withTransaction, OptimisticLockingUtil } from '@xmoonx/moon-lib';

router.post('/api/orders', withTransaction(), async (req, res) => {
  // req.dbSession otomatik olarak mevcut
  const order = Order.build(orderData);
  await OptimisticLockingUtil.saveWithContext(order, req);
  
  await OptimisticLockingUtil.updateWithContext(
    ProductStock, 
    productId, 
    { $inc: { availableStock: -quantity } },
    req
  );
  
  res.json(order); // Otomatik commit tetiklenir
});
```

### Mevcut Koddan Geçiş

```typescript
// ÖNCESİ (Manuel transaction management)
const session = await mongoose.startSession();
try {
  await session.startTransaction();
  
  await OptimisticLockingUtil.saveWithRetry(product, 'Product');
  await OptimisticLockingUtil.saveWithRetry(category, 'Category');
  
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  await session.endSession();
}

// SONRASI (Transaction middleware)
router.post('/api/products', withTransaction(), async (req, res) => {
  await OptimisticLockingUtil.saveWithContext(product, req);
  await OptimisticLockingUtil.saveWithContext(category, req);
  
  res.json({ success: true }); // Otomatik commit
});
```

## 📚 API Referansı

### withTransaction(options?)

Ana transaction middleware'i.

```typescript
interface TransactionOptions {
  timeoutMs?: number;        // Default: 30000 (30 saniye)
  readConcern?: 'snapshot';  // Default: 'snapshot'
  writeConcern?: object;     // Default: { w: 'majority' }
  readPreference?: string;   // Default: 'primary'
  skipTransaction?: boolean; // Default: false
  onError?: (error, session) => Promise<void>;
  onSuccess?: (session) => Promise<void>;
}
```

### Özel Middleware Türleri

```typescript
// Bulk operations için optimize edilmiş
withBulkTransaction({ timeoutMs: 60000 })

// Read-only operasyonlar için
withReadOnlyTransaction({ readPreference: 'secondaryPreferred' })

// Koşullu transaction
withConditionalTransaction(
  (req) => req.body.requiresTransaction,
  { timeoutMs: 45000 }
)
```

### Context-Aware OptimisticLockingUtil

```typescript
// Session otomatik algılama
await OptimisticLockingUtil.saveWithContext(document, req, 'OperationName');
await OptimisticLockingUtil.updateWithContext(Model, id, data, req);
await OptimisticLockingUtil.bulkWithContext(Model, operations, req);

// Manuel session ile (backward compatibility)
await OptimisticLockingUtil.saveWithRetry(document, 'Name', session);
await OptimisticLockingUtil.updateWithRetry(Model, id, data, {}, 'Name', session);

// Legacy kullanım (session olmadan)
await OptimisticLockingUtil.saveWithRetry(document, 'Name');
await OptimisticLockingUtil.updateWithRetry(Model, id, data);
```

### Utility Fonksiyonlar

```typescript
// Session durumu kontrolü
const hasSession = OptimisticLockingUtil.getSessionFromRequest(req);
const inTransaction = OptimisticLockingUtil.isInTransaction(req);

// İstatistikler
const stats = OptimisticLockingUtil.getStats(req);
const transactionStats = getTransactionStats(req);

// Manuel kontrol (ileri seviye)
await TransactionControl.commit(req);
await TransactionControl.rollback(req);
```

## 🛠️ Kullanım Örnekleri

### 1. Sipariş Oluşturma

```typescript
router.post('/api/orders', 
  requireAuth,
  withTransaction(),
  async (req, res) => {
    const { orderData, items } = req.body;
    
    // Stok kontrolü
    for (const item of items) {
      const stock = await ProductStock.findOne({ product: item.productId });
      if (stock.availableStock < item.quantity) {
        throw new Error(`Insufficient stock for ${item.productId}`);
      }
    }
    
    // Sipariş oluştur
    const order = Order.build({ ...orderData, user: req.currentUser.id });
    await OptimisticLockingUtil.saveWithContext(order, req);
    
    // Sipariş ürünleri ve stok güncellemesi
    for (const item of items) {
      const orderProduct = OrderProduct.build({
        order: order.id,
        product: item.productId,
        quantity: item.quantity,
        price: item.price
      });
      
      await OptimisticLockingUtil.saveWithContext(orderProduct, req);
      
      await OptimisticLockingUtil.updateWithContext(
        ProductStock,
        item.stockId,
        { $inc: { availableStock: -item.quantity } },
        req
      );
    }
    
    res.json({ success: true, order });
    // Otomatik commit - tüm işlemler atomik olarak uygulanır
  }
);
```

### 2. Bulk İşlemler

```typescript
router.post('/api/products/bulk-update',
  requireAuth,
  withBulkTransaction({ timeoutMs: 120000 }),
  async (req, res) => {
    const { updates } = req.body;
    
    const results = [];
    
    for (const update of updates) {
      const product = await OptimisticLockingUtil.updateWithContext(
        Product,
        update.id,
        update.data,
        req
      );
      results.push(product);
    }
    
    res.json({ 
      success: true, 
      updated: results.length,
      transactionId: req.transactionId 
    });
  }
);
```

### 3. Karmaşık İş Mantığı

```typescript
router.post('/api/products/with-variants',
  requireAuth,
  withTransaction({ timeoutMs: 45000 }),
  async (req, res) => {
    const { productData, variants, images } = req.body;
    
    // Ana ürün
    const product = Product.build({ ...productData, user: req.currentUser.id });
    await OptimisticLockingUtil.saveWithContext(product, req);
    
    // Varyantlar
    const createdVariants = [];
    for (const variantData of variants) {
      const variant = Combination.build({
        ...variantData,
        product: product.id,
        user: req.currentUser.id
      });
      
      await OptimisticLockingUtil.saveWithContext(variant, req);
      createdVariants.push(variant);
    }
    
    // Resimler
    const createdImages = [];
    for (let i = 0; i < images.length; i++) {
      const image = ProductImage.build({
        ...images[i],
        product: product.id,
        user: req.currentUser.id,
        sort: i
      });
      
      await OptimisticLockingUtil.saveWithContext(image, req);
      createdImages.push(image);
    }
    
    res.json({
      success: true,
      product,
      variants: createdVariants,
      images: createdImages,
      transaction: {
        id: req.transactionId,
        operationsCount: 1 + createdVariants.length + createdImages.length
      }
    });
  }
);
```

### 4. Event Listener'da Kullanım

```typescript
export class ProductStockUpdatedListener extends RetryableListener {
  async onMessage(data: ProductStockUpdatedEvent['data'], msg: Message) {
    // Session-aware operasyon (event context'inde session yok, normal operation)
    const product = await Product.findById(data.productId);
    if (product) {
      product.lastStockUpdate = new Date();
      await OptimisticLockingUtil.saveWithRetry(product, 'ProductStockSync');
    }
    
    msg.ack();
  }
}
```

## 🔧 Konfigürasyon

### Global Defaults

```typescript
// app.ts veya configuration dosyasında
const defaultTransactionOptions = {
  timeoutMs: 30000,
  readConcern: 'snapshot' as const,
  writeConcern: { w: 'majority', wtimeout: 30000 },
  readPreference: 'primary'
};
```

### Service-Specific Configuration

```typescript
// Products service
const productTransactionConfig = {
  timeoutMs: 45000, // Ürün işlemleri daha uzun sürebilir
  onSuccess: async (session) => {
    // Başarılı transaction sonrası cache invalidation
    await invalidateProductCache();
  }
};

// Orders service  
const orderTransactionConfig = {
  timeoutMs: 60000, // Sipariş işlemleri karmaşık olabilir
  onError: async (error, session) => {
    // Hata durumunda alert gönder
    await sendErrorAlert('Order transaction failed', error);
  }
};
```

## 🧪 Test Stratejisi

```typescript
describe('Transaction Middleware', () => {
  it('should commit successful transactions', async () => {
    const response = await request(app)
      .post('/api/orders')
      .send(validOrderData)
      .expect(201);
    
    expect(response.body.success).toBe(true);
    
    // Verify data persistence
    const order = await Order.findById(response.body.order.id);
    expect(order).toBeDefined();
  });
  
  it('should rollback failed transactions', async () => {
    await request(app)
      .post('/api/orders')
      .send(invalidOrderData)
      .expect(400);
    
    // Verify no data was persisted
    const orders = await Order.find({});
    expect(orders).toHaveLength(0);
  });
});
```

## 📊 Performance İpuçları

1. **Timeout Ayarları**: Karmaşık işlemler için timeout süresini artırın
2. **Bulk Operations**: Çoklu işlemler için `withBulkTransaction` kullanın
3. **Read-Only Operations**: Sadece okuma işlemleri için `withReadOnlyTransaction`
4. **Connection Pooling**: MongoDB connection pool boyutunu transaction yoğunluğuna göre ayarlayın
5. **Monitoring**: Transaction sürelerini izleyin ve optimize edin

## ⚠️ Önemli Notlar

- Transaction middleware sadece MongoDB Atlas'ta desteklenir
- Tüm collection'lar sharded olmamalı (transaction limitasyonu)
- Uzun süren transaction'lar deadlock riskini artırır
- Error handling'i her zaman test edin
- Production'da transaction timeout değerlerini dikkatli ayarlayın

## 🔄 Migration Rehberi

### Aşama 1: Yeni Route'lar
```typescript
// Yeni route'larda middleware kullan
router.post('/api/v2/orders', withTransaction(), handler);
```

### Aşama 2: Mevcut Route'lar
```typescript
// Mevcut route'larda saveWithContext'e geç
await OptimisticLockingUtil.saveWithContext(document, req);
```

### Aşama 3: Service Layer
```typescript
// Service'lerde session parameter ekle
async createOrder(data: any, session?: ClientSession) {
  // Implementation
}
```

Bu rehber ile MongoDB Transaction Middleware'ini projenizdeki tüm servislerde etkili bir şekilde kullanabilirsiniz.