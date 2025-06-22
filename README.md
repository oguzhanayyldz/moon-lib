# moon-lib

Moon ekosistemindeki tüm mikroservisler için ortak kütüphane. Bu paket, kimlik doğrulama, hata yönetimi, güvenlik, veri doğrulama ve olay işleme gibi özellikleri sağlar.

## İçindekiler

- [Kurulum](#kurulum)
- [Modüller](#modüller)
  - [Güvenlik](#güvenlik)
  - [Hata Yönetimi](#hata-yönetimi)
  - [Kimlik Doğrulama](#kimlik-doğrulama)
  - [Olaylar](#olaylar)
- [Kullanım Örnekleri](#kullanım-örnekleri)

## Kurulum

Bu paketi mikroservis projenize eklemek için:

```bash
npm install @xmoonx/moon-lib
```

## Modüller

### Güvenlik

Moon ekosistemindeki tüm mikroservislere kapsamlı güvenlik özellikleri sağlayan modüldür.

#### MicroserviceSecurityService

Merkezi güvenlik hizmetini sağlar. Her mikroservis için bir örnek oluşturulmalıdır:

```typescript
import { MicroserviceSecurityService, MicroserviceSecurityConfig } from '@xmoonx/moon-lib';

const securityConfig: MicroserviceSecurityConfig = {
  serviceName: 'my-service',
  apiPathRegex: /^\/api\/my-service\/?/,
  // ... diğer konfigürasyon seçenekleri
};

export const myServiceSecurityService = new MicroserviceSecurityService(securityConfig);
```

#### Güvenlik Middleware'leri

MicroserviceSecurityService tarafından sağlanan middleware'ler:

##### 1. NoSQL Injection Koruması

**Yeni Özellik**: `getNoSQLSanitizerMiddleware()` - Tüm HTTP isteklerindeki req.body, req.params ve req.query içeriklerini NoSQL enjeksiyon saldırılarına karşı sanitize eder.

```typescript
// app.ts içinde
app.use(myServiceSecurityService.getNoSQLSanitizerMiddleware());
```

Bu middleware:
- Nesneler için `mongo-sanitize` kütüphanesini kullanır
- String değerler için XSS koruması sağlar
- Nested objeler için derinlemesine sanitizasyon uygular

##### 2. Güvenli CORS Yapılandırması

**Uygulama Örneği**: Her mikroservis için aşağıdaki şekilde CORS yapılandırması ekleyin:

```typescript
import cors from 'cors';

// Güvenli whitelist CORS yapılandırması
const corsOptions = {
  origin: function (origin, callback) {
    const whitelist = [
      'https://app.example.com',
      'https://admin.example.com',
      'http://localhost:3000'
    ];
    
    if (!origin || whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy: Origin not allowed'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true,
  maxAge: 86400,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token']
};

app.use(cors(corsOptions));
```

##### 3. JWT Tabanlı CSRF Koruması

**Yeni Özellik**: `getJwtCsrfProtectionMiddleware()` - POST, PUT, DELETE, PATCH gibi durum değiştiren istekler için token tabanlı CSRF koruması sağlar.

```typescript
// app.ts içinde
app.use(myServiceSecurityService.getJwtCsrfProtectionMiddleware());
```

Bu middleware:
- Durum değiştiren HTTP metodlarını (POST, PUT, DELETE, PATCH) CSRF saldırılarına karşı korur
- GET ve HEAD gibi güvenli HTTP metodlarını es geçer
- `X-CSRF-Token` header'ını kontrol eder ve doğrular
- Kullanıcı ile birlikte tarayıcı parmak izi verilerini doğrular
- Tüm isteklerde JWT_SECRET ortam değişkeni kullanır

**Auth Service Entegrasyonu:**
Token'ları üretmek ve yenilemek için auth servisinde iki endpoint oluşturulmuştur:

- `GET /api/auth/csrf-token`: İlk CSRF token'larını üretir
- `GET /api/auth/refresh-csrf-token`: Mevcut süresi dolmuş CSRF token'larını yeniler

**İstemci Tarafı Kullanımı:**

```javascript
// İstemci tarafında CSRF token alma
axios.get('/api/auth/csrf-token')
  .then(response => {
    localStorage.setItem('csrf_token', response.data.token);
  });

// Durum değiştiren isteklere token ekleme
axios.post('/api/my-service/resource', data, {
  headers: {
    'X-CSRF-Token': localStorage.getItem('csrf_token')
  }
});
```

##### 4. Diğer Güvenlik Özellikleri

```typescript
// Güvenlik başlıkları (her zaman ilk middleware olarak kullanın)
app.use(myServiceSecurityService.getSecurityHeadersMiddleware());

// API rate limiting
app.use(myServiceSecurityService.getRateLimitMiddleware());

// Brute force koruması (özellikle giriş endpointleri için)
app.use(myServiceSecurityService.getBruteForceMiddleware());
```

#### SecurityValidator

`SecurityValidator` sınıfı, tüm kullanıcı girdilerini güvenli hale getirmek için kullanılır:

```typescript
import { SecurityValidator } from '@xmoonx/moon-lib';

const validator = new SecurityValidator();

// String sanitizasyonu
const sanitizedInput = validator.sanitizeInput('<script>alert("XSS")</script>');

// Nesne sanitizasyonu (NoSQL enjeksiyon koruması)
const sanitizedObject = validator.sanitizeInput({
  name: 'user',
  query: { $where: 'malicious code' }
});
```

### Hata Yönetimi

// Diğer modüller için dokümantasyon buraya eklenecek

## Kullanım Örnekleri

### Tam Güvenlik Yapılandırması

```typescript
import express from 'express';
import { json } from 'body-parser';
import { myServiceSecurityService, errorHandler } from '@xmoonx/moon-lib';
import cors from 'cors';

const app = express();

// 1. Security headers middleware (ilk sırada olmalı)
app.use(myServiceSecurityService.getSecurityHeadersMiddleware());

// 2. CORS yapılandırması
const corsOptions = { /* yukarıda belirtilen CORS yapılandırması */ };
app.use(cors(corsOptions));

app.set('trust proxy', true);
app.use(json());
// Diğer temel middleware'ler...

// 3. NoSQL enjeksiyon ve XSS koruması
app.use(myServiceSecurityService.getNoSQLSanitizerMiddleware());

// 4. Rate limiting
app.use(myServiceSecurityService.getRateLimitMiddleware());

// 5. API yolları için brute force koruması
const apiPathRegex = /^\/api\/my-service\/?/;
app.use((req, res, next) => {
  if (apiPathRegex.test(req.path)) {
    return myServiceSecurityService.getBruteForceMiddleware()(req, res, next);
  }
  next();
});

// Route tanımlamaları...

// Hata işleme
app.use(errorHandler);
```