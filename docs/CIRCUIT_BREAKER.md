# Circuit Breaker Pattern - Fault Tolerance

## 📋 Genel Bakış

Circuit Breaker pattern, dış servislerdeki hatalardan uygulamayı korumak için kullanılan fault tolerance mekanizmasıdır. Moon Project'te BaseApiClient ile entegre şekilde çalışır.

## 🔄 Circuit Breaker States

### CLOSED (Kapalı) - Normal Çalışma
- Tüm istekler normal şekilde gönderilir
- Hata sayısı izlenir
- Eşik aşılırsa OPEN duruma geçer

### OPEN (Açık) - Koruma Modu  
- Tüm istekler reddedilir
- Dış servise hiç istek gönderilmez
- Reset timeout süresince bekler
- Timeout sonrası HALF_OPEN duruma geçer

### HALF_OPEN (Yarı Açık) - Test Modu
- Sınırlı sayıda test isteği gönderilir
- Başarılı ise CLOSED duruma döner
- Başarısız ise tekrar OPEN duruma geçer

## ⚙️ Konfigürasyon

```typescript
interface CircuitBreakerConfig {
  failureThreshold: number;         // Hata eşiği (örn: 5)
  resetTimeout: number;             // Reset timeout ms (örn: 30000)
  monitoringPeriod: number;         // İzleme periyodu ms (örn: 10000)
  expectedErrors: string[];         // Beklenen hata kodları
  fallbackEnabled: boolean;         // Fallback aktif mi
  halfOpenMaxCalls: number;         // Half-open'da max call sayısı
}
```

## 🚀 Kullanım Örnekleri

### Shopify için Circuit Breaker

```typescript
const circuitBreakerConfig: CircuitBreakerConfig = {
  failureThreshold: 5,                    // 5 hata sonrası aç
  resetTimeout: 30000,                    // 30 saniye sonra test et
  monitoringPeriod: 10000,                // 10 saniye izleme penceresi
  expectedErrors: [
    'ECONNREFUSED',                       // Bağlantı reddedildi
    'ETIMEDOUT',                          // Zaman aşımı
    'ENOTFOUND',                          // DNS hatası
    '500', '502', '503', '504'            // Server hataları
  ],
  fallbackEnabled: true,                  // Fallback aktif
  halfOpenMaxCalls: 3                     // Test için 3 call
};
```

### Trendyol için Circuit Breaker

```typescript
const circuitBreakerConfig: CircuitBreakerConfig = {
  failureThreshold: 3,                    // Daha agresif koruma
  resetTimeout: 60000,                    // 1 dakika bekle  
  monitoringPeriod: 15000,                // 15 saniye izleme
  expectedErrors: [
    'ECONNREFUSED', 'ETIMEDOUT', 
    '429',                                // Rate limit
    '500', '502', '503'
  ],
  fallbackEnabled: true,
  halfOpenMaxCalls: 2
};
```

## 📊 Monitoring ve Metrics

### Circuit Breaker Metrics

```typescript
interface CircuitBreakerMetrics {
  state: CircuitBreakerState;             // Mevcut durum
  failureCount: number;                   // Hata sayısı
  successCount: number;                   // Başarı sayısı
  totalCalls: number;                     // Toplam çağrı
  lastFailureTime?: number;               // Son hata zamanı
  lastSuccessTime?: number;               // Son başarı zamanı
  nextRetryTime?: number;                 // Sonraki deneme zamanı
}

// Metrics erişimi
const metrics = apiClient.getCircuitBreakerMetrics();
console.log(`Circuit Breaker State: ${metrics.state}`);
console.log(`Failure Rate: ${metrics.failureCount}/${metrics.totalCalls}`);
```

### Logging

Circuit breaker tüm state değişikliklerini loglar:

```typescript
// CLOSED -> OPEN
logger.warn('Circuit breaker opened', {
  serviceName: 'shopify-api-client',
  failureCount: 5,
  threshold: 5,
  nextRetryTime: Date.now() + 30000
});

// OPEN -> HALF_OPEN  
logger.info('Circuit breaker half-opened', {
  serviceName: 'shopify-api-client',
  maxCalls: 3
});

// HALF_OPEN -> CLOSED
logger.info('Circuit breaker closed', {
  serviceName: 'shopify-api-client',
  successfulCalls: 3
});
```

## 🔧 State Management

### State Transitions

```typescript
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    switch (this.state) {
      case CircuitBreakerState.CLOSED:
        return this.executeInClosedState(fn);
        
      case CircuitBreakerState.OPEN:
        return this.executeInOpenState(fn);
        
      case CircuitBreakerState.HALF_OPEN:
        return this.executeInHalfOpenState(fn);
    }
  }
}
```

### Error Handling

```typescript
private handleError(error: any): void {
  this.metrics.failureCount++;
  this.metrics.lastFailureTime = Date.now();

  // Hata eşiği kontrolü
  if (this.shouldTripCircuit()) {
    this.openCircuit();
  }
}

private shouldTripCircuit(): boolean {
  const withinMonitoringPeriod = this.isWithinMonitoringPeriod();
  const exceedsThreshold = this.metrics.failureCount >= this.config.failureThreshold;
  
  return withinMonitoringPeriod && exceedsThreshold;
}
```

## 🎯 Best Practices

### Timeout Değerleri

```typescript
// Hızlı serviler için
const fastServiceConfig = {
  failureThreshold: 3,
  resetTimeout: 15000,        // 15 saniye
  monitoringPeriod: 10000     // 10 saniye
};

// Yavaş serviler için  
const slowServiceConfig = {
  failureThreshold: 5,
  resetTimeout: 60000,        // 1 dakika
  monitoringPeriod: 30000     // 30 saniye
};
```

### Error Classification

```typescript
const transientErrors = [
  'ECONNREFUSED',             // Geçici bağlantı sorunu
  'ETIMEDOUT',                // Timeout
  '429',                      // Rate limit
  '502', '503', '504'         // Geçici server hataları
];

const permanentErrors = [
  '400',                      // Bad request
  '401',                      // Unauthorized
  '403',                      // Forbidden
  '404'                       // Not found
];
```

### Fallback Strategies

```typescript
// Cache'den veri dön
private async fallbackToCache<T>(key: string): Promise<T> {
  const cached = await this.cache.get(key);
  if (cached) {
    logger.info('Circuit breaker fallback: returning cached data');
    return cached;
  }
  throw new Error('No fallback data available');
}

// Default değer dön
private getDefaultValue<T>(defaultValue: T): T {
  logger.info('Circuit breaker fallback: returning default value');
  return defaultValue;
}
```

## 🧪 Testing

### Unit Tests

```typescript
describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  
  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 1000,
      monitoringPeriod: 5000,
      expectedErrors: ['500'],
      fallbackEnabled: true,
      halfOpenMaxCalls: 2
    }, 'test-service');
  });

  it('should open circuit after threshold failures', async () => {
    // 3 kez hata üret
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(() => Promise.reject(new Error('500')));
      } catch (e) {}
    }
    
    const metrics = circuitBreaker.getMetrics();
    expect(metrics.state).toBe(CircuitBreakerState.OPEN);
  });

  it('should transition to half-open after timeout', async () => {
    // Circuit'i aç
    await openCircuit();
    
    // Timeout'u bekle
    await sleep(1100);
    
    // Test çağrısı yap
    await circuitBreaker.execute(() => Promise.resolve('test'));
    
    const metrics = circuitBreaker.getMetrics();
    expect(metrics.state).toBe(CircuitBreakerState.HALF_OPEN);
  });
});
```

### Integration Tests

```typescript
describe('BaseApiClient with CircuitBreaker', () => {
  it('should handle service outage gracefully', async () => {
    // Mock server'ı kapatma simülasyonu
    mockServer.close();
    
    // Circuit breaker açılana kadar istekler gönder
    for (let i = 0; i < 5; i++) {
      try {
        await apiClient.get('/test');
      } catch (e) {
        // Hatalar bekleniyor
      }
    }
    
    // Circuit açık olmalı
    const metrics = apiClient.getCircuitBreakerMetrics();
    expect(metrics.state).toBe(CircuitBreakerState.OPEN);
    
    // Sonraki istekler hemen reddedilmeli
    const start = Date.now();
    try {
      await apiClient.get('/test');
    } catch (e) {
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // Hızlı rejection
    }
  });
});
```

## 🔍 Troubleshooting

### Circuit Açık Kalmış

```bash
# Circuit breaker state kontrol et
curl http://localhost:3000/metrics/circuit-breaker

# Logs'da son hataları kontrol et  
grep "Circuit breaker" /var/log/app.log

# Manuel reset (acil durum)
curl -X POST http://localhost:3000/admin/circuit-breaker/reset
```

### Çok Sık Açılıyor

- `failureThreshold` değerini artır
- `monitoringPeriod` süresini uzat
- Expected errors listesini gözden geçir

### Çok Geç Açılıyor

- `failureThreshold` değerini düşür  
- `monitoringPeriod` süresini kısalt
- Hata kategorilerini daralt

## 📈 Performance Impact

### Memory Usage

```typescript
// Circuit breaker per instance: ~1KB
// Metrics storage: ~500 bytes
// Timer/interval: ~100 bytes
// Total: ~1.6KB per service
```

### CPU Overhead

```typescript
// State check: O(1) - ~0.1ms
// Metrics update: O(1) - ~0.05ms  
// Timer operations: ~0.02ms
// Total overhead: <1% CPU usage
```

## 🔄 Advanced Features

### Adaptive Thresholds

```typescript
// Hata oranına göre dinamik threshold
const adaptiveThreshold = Math.max(
  this.config.failureThreshold,
  this.metrics.totalCalls * 0.1  // %10 hata oranı
);
```

### Health Check Integration

```typescript
// Health endpoint'den circuit breaker durumunu dön
app.get('/health', (req, res) => {
  const circuitBreakerMetrics = apiClient.getCircuitBreakerMetrics();
  
  res.json({
    status: circuitBreakerMetrics.state === 'CLOSED' ? 'healthy' : 'degraded',
    circuitBreaker: circuitBreakerMetrics
  });
});
```

---

**Versiyon**: 1.0.0  
**Son Güncelleme**: Aralık 2024  
**Geliştirici**: Moon Project Team