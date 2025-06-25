# BaseApiClient - Ortak API İstemci Mimarisi

## 📋 Genel Bakış

BaseApiClient, Moon Project'te tüm entegrasyon API istemcileri için standardized bir temel sınıf sağlar. Circuit Breaker pattern, rate limiting, retry logic, request queueing ve logging gibi ortak özellikleri merkezi bir yapıda sunar.

## 🏗️ Mimari Özellikleri

### Core Bileşenler

- **Circuit Breaker**: API erişilebilirlik sorunlarında otomatik koruma
- **Rate Limiting**: Platform limitlerini aşmamak için istek kontrolü  
- **Request Queueing**: Eşzamanlı istek yönetimi
- **Retry Logic**: Exponential backoff ile akıllı yeniden deneme
- **Request/Response Logging**: Entegrasyon logları ve debugging
- **Distributed Tracing**: OpenTracing uyumlu performans izleme

### Dependency Injection Pattern

```typescript
constructor(
  config: BaseApiClientConfig, 
  serviceName: string, 
  integrationName: ResourceName,
  tracer?: any,
  logService?: IntegrationRequestLogService
)
```

## 🚀 Kullanım Örnekleri

### Shopify API Client Implementasyonu

```typescript
import { BaseApiClient, ResourceName, IntegrationRequestLogService } from '@xmoonx/moon-lib';
import mongoose from 'mongoose';

export class ShopifyApiClient extends BaseApiClient {
  constructor(
    shopName: string, 
    accessToken: string, 
    apiVersion: string = '2023-10', 
    userId?: string,
    logService?: IntegrationRequestLogService
  ) {
    const config: BaseApiClientConfig = {
      rateLimiter: {
        points: 35,        // GraphQL için 40'dan az (güvenlik marjı)
        duration: 60       // 1 dakika
      },
      queue: {
        concurrency: 2,    // Aynı anda maksimum 2 istek
        intervalCap: 4,    // Her aralık için maksimum istek
        interval: 1000,    // 1 saniye
        autoStart: true
      },
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 30000,     // 30 saniye
        monitoringPeriod: 10000, // 10 saniye
        expectedErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', '500', '502', '503', '504'],
        fallbackEnabled: true,
        halfOpenMaxCalls: 3
      },
      timeout: 30000,
      userId,
      retries: {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffFactor: 2,
        retryableErrors: ['429', '500', '502', '503', '504']
      }
    };

    super(config, 'shopify-api-client', ResourceName.Shopify, tracer, logService);
  }

  // Abstract method implementations
  getBaseURL(): string {
    return `https://${this.shopName}.myshopify.com/admin/api/${this.apiVersion}`;
  }

  getDefaultHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': this.accessToken,
      'User-Agent': 'Moon Project/1.0'
    };
  }

  async handleRateLimitError(error: AxiosError): Promise<void> {
    const retryAfter = error.response?.headers['retry-after'];
    let delay = 5000; // Default 5 seconds

    if (retryAfter) {
      delay = parseInt(retryAfter) * 1000;
    }

    await sleep(delay);
  }

  shouldRetry(error: AxiosError): boolean {
    if (!error.response) return true; // Network errors

    const status = error.response.status;
    return status === 429 || (status >= 500 && status < 600);
  }
}
```

### Entegrasyon Servisinde Kullanım

```typescript
import { IntegrationRequestLogService } from '@xmoonx/moon-lib';
import { ShopifyApiClient } from '../services/api-client';
import mongoose from 'mongoose';

class ShopifyIntegration {
  private initializeApiClient(): void {
    // Her mikroserviste kendi database connection'ı ile LogService oluştur
    const logService = new IntegrationRequestLogService(mongoose.connection);

    this.apiClient = new ShopifyApiClient(
      this.credentials.shopName,
      this.credentials.accessToken,
      this.credentials.apiVersion,
      this.credentials.user,
      logService // Servise özel LogService inject et
    );
  }
}
```

## ⚙️ Konfigürasyon Seçenekleri

### Rate Limiter Konfigürasyonu

```typescript
interface ApiRateLimitConfig {
  points: number;        // İzin verilen istek sayısı
  duration: number;      // Süre (saniye)
  blockDuration?: number; // Block süresi (saniye)
}
```

### Queue Konfigürasyonu

```typescript
interface QueueConfig {
  concurrency: number;              // Eşzamanlı istek sayısı
  intervalCap: number;              // Aralık başına maksimum istek
  interval: number;                 // Aralık süresi (ms)
  timeout?: number;                 // Timeout süresi
  carryoverConcurrencyCount?: boolean;
  autoStart?: boolean;
}
```

### Circuit Breaker Konfigürasyonu

```typescript
interface CircuitBreakerConfig {
  failureThreshold: number;         // Hata eşiği
  resetTimeout: number;             // Reset timeout (ms)
  monitoringPeriod: number;         // İzleme periyodu (ms)
  expectedErrors: string[];         // Beklenen hata kodları
  fallbackEnabled: boolean;         // Fallback aktif mi
  halfOpenMaxCalls: number;         // Half-open durumunda max call
}
```

### Retry Konfigürasyonu

```typescript
interface ApiRetryConfig {
  maxRetries: number;               // Maksimum yeniden deneme
  initialDelay: number;             // İlk gecikme (ms)
  maxDelay: number;                 // Maksimum gecikme (ms)
  backoffFactor: number;            // Exponential backoff faktörü
  retryableErrors: string[];        // Yeniden deneme yapılacak hatalar
}
```

## 📊 Monitoring ve Metrics

### API Request Metrics

```typescript
interface ApiRequestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastRequestTime?: number;
}

// Metrics erişimi
const metrics = apiClient.getMetrics();
const circuitBreakerMetrics = apiClient.getCircuitBreakerMetrics();
```

### Logging

BaseApiClient otomatik olarak tüm request/response'ları loglar:

- **Request Logging**: HTTP method, endpoint, headers, body
- **Response Logging**: Status code, headers, body, duration
- **Error Logging**: Hata detayları ve context bilgileri
- **Performance Logging**: Response time ve throughput metrikleri

### Distributed Tracing

OpenTracing uyumlu distributed tracing desteği:

```typescript
const span = tracer.startSpan('api-request-get');
span.setTag('http.method', 'GET');
span.setTag('http.url', '/products');
span.setTag('http.status_code', 200);
span.finish();
```

## 🔐 Security Özellikleri

### Sensitive Data Sanitization

IntegrationRequestLogService otomatik olarak hassas bilgileri temizler:

- Authorization headers → `***REDACTED***`
- API keys → `***REDACTED***`
- Passwords → `***REDACTED***`
- Tokens → `***REDACTED***`

### Rate Limiting Protection

Her kullanıcı/entegrasyon için ayrı rate limiting:

```typescript
const userId = this.config.userId || 'default';
await this.rateLimiter.consume(userId, 1);
```

## 🚨 Error Handling

### Circuit Breaker States

- **CLOSED**: Normal çalışma modu
- **OPEN**: Hata eşiği aşıldığında API çağrıları engellenir
- **HALF_OPEN**: Test çağrıları yapılarak recovery kontrol edilir

### Retry Logic

Exponential backoff ile akıllı yeniden deneme:

```
Attempt 1: 1000ms delay
Attempt 2: 2000ms delay  
Attempt 3: 4000ms delay
Max delay: 10000ms
```

### Error Categorization

- **Network Errors**: Yeniden denenebilir
- **Rate Limit (429)**: Retry-After header'ına göre bekle
- **Server Errors (5xx)**: Yeniden denenebilir
- **Client Errors (4xx)**: Yeniden denenmez

## 🧪 Testing

### Mock Yapısı

```typescript
import { natsWrapper, redisWrapper, OptimisticLockingUtil } from '@xmoonx/moon-lib/dist-test/index.test';

describe('BaseApiClient Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should handle rate limiting', async () => {
    // Test implementation
  });
});
```

## 📈 Performance Optimizations

### Connection Pooling

HTTP client'ı axios ile connection pooling destekli:

```typescript
this.httpClient = axios.create({
  baseURL: this.getBaseURL(),
  timeout: config.timeout,
  headers: this.getDefaultHeaders()
});
```

### Memory Management

- Circuit breaker metrics memory'de tutulur
- Rate limiter in-memory cache kullanır
- Queue işlemleri memory-efficient şekilde yönetilir

## 🔧 Troubleshooting

### Common Issues

1. **Rate Limit Exceeded**: points ve duration değerlerini kontrol edin
2. **Circuit Breaker Open**: failureThreshold ve resetTimeout ayarlarını gözden geçirin
3. **Timeout Errors**: timeout değerini artırın
4. **Memory Issues**: concurrency değerini düşürün

### Debug Logs

```typescript
logger.debug('HTTP Request', {
  method: config.method?.toUpperCase(),
  url: config.url,
  headers: config.headers
});
```

## 🔄 Migration Guide

### Mevcut API Client'ları Migrate Etme

1. BaseApiClient'ı extend edin
2. Abstract method'ları implement edin
3. Konfigürasyonu BaseApiClientConfig formatına çevirin
4. IntegrationRequestLogService'i inject edin
5. Test suite'i güncelleyin

### Breaking Changes

- Constructor parametreleri değişti
- Rate limiter konfigürasyonu güncellenip
- Logging service dependency injection gerekiyor

---

**Versiyon**: 1.0.0  
**Son Güncelleme**: Aralık 2024  
**Geliştirici**: Moon Project Team