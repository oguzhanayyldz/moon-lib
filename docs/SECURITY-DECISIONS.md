# Güvenlik Risk Kararları

Bu dosya, dependabot/audit uyarılarının **kapsam dışı bırakıldığı veya "kabul edilen risk"**
olarak kapatıldığı kararları kayıt altına alır — böylece aynı uyarı tekrar açıldığında
(veya yeni bir mühendis inceleme yaptığında) gerekçe kaynak koddan yeniden çıkarılmak
zorunda kalınmaz.

Her karar şu formatta eklenir: tarih, ilgili görev/PR, advisory, gerekçe, yeniden
değerlendirme koşulu.

---

## 2026-09-18 — `uuid@8.3.2` (transitive, GHSA-w5hq-g745-h8pq) — Aksiyon alınmadı

**Görev:** TASK-MU6ECD1ATX1R9 (moon-lib PR #75'in kapsam dışı bıraktığı transitive uyarı)

**Advisory:** [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) /
CVE-2026-41907 — `uuid` paketinin `v3()`, `v5()`, `v6()` fonksiyonları, çağıran tarafından
sağlanan **harici buffer + offset** parametresiyle çağrıldığında sınır kontrolü yapmadan
`buf[offset + i]` yazıyor; bu sessiz/kısmi yazışa ve dolayısıyla hatalı UUID üretimine yol
açabiliyor. `v1()`, `v4()`, `v7()` etkilenmiyor (bu durumda `RangeError` fırlatıyorlar).
Etkilenen aralık: `< 11.1.1` (ayrıca `12.0.0–12.0.0` ve `13.0.0–13.0.0`). Düzeltme: `11.1.1`.

**Durum:** moon-lib'in doğrudan bağımlılığı zaten `^11.1.1` (PR #75, `bb0ffd0`). Ancak
`pnpm why uuid` iki transitive kopya daha gösteriyor:

```
uuid@8.3.2
├─┬ exceljs@4.4.0
│ └── @xmoonx/moon-lib@1.1.3 (dependencies)
└─┬ jaeger-client@3.19.0
  └── @xmoonx/moon-lib@1.1.3 (dependencies)

uuid@11.1.1
└── @xmoonx/moon-lib@1.1.3 (dependencies)
```

**Kaynak grep sonucu — savunmasız API hiç çağrılmıyor:**

- `exceljs@4.4.0` → `node_modules/exceljs/lib/xlsx/xform/sheet/cf-ext/cf-rule-ext-xform.js`:
  `const {v4: uuidv4} = require('uuid')`, iki çağrı da parametresiz: `` `{${uuidv4()}}` ``.
  Sadece `v4()` kullanılıyor; `v3/v5/v6` hiç import edilmemiş.
- `jaeger-client@3.19.0` → `dist/src/tracer.js:161`: `var uuid = (0, _uuid.v4)();` — yine
  parametresiz `v4()`. `v3/v5/v6` hiç kullanılmıyor.

Sonuç: GHSA-w5hq-g745-h8pq yalnızca `v3/v5/v6`'ya **buffer+offset** verildiğinde
tetikleniyor. Her iki bağımlılık da yalnızca parametresiz `v4()` çağırıyor — savunmasız
kod yolu bu iki paket üzerinden **hiçbir şekilde erişilebilir değil**. Risk **teorik**tir,
sürüm aralığına düşse bile pratikte sömürülebilir değildir.

**Yukarı akış (upstream) durumu:** Her iki paket de npm registry'deki **en güncel yayınlanmış
sürümde** (`exceljs@4.4.0`, `jaeger-client@3.19.0`) ve ikisi de kendi `uuid` bağımlılığını
henüz yükseltmemiş (`exceljs` → `^8.3.0`, `jaeger-client` → `^8.3.2`, değişmiyor). Yükseltme
yoluyla kapatma seçeneği yok.

**`jaeger-client` kaldırma değerlendirmesi:** Paket deprecated olsa da (OpenTelemetry'ye geçiş
öneriliyor), moon-lib'de ölü kod DEĞİL — `src/services/tracer.service.ts` üzerinden
`createTracer()` export ediliyor ve **31 mikroservisin tamamına yakınında** aktif olarak
kullanılıyor (her serviste `src/services/tracer.ts` + `app.ts` içinde
`tracer.startSpan('http_request')` ile her HTTP isteğine dağıtık izleme span'i ekleniyor,
`auth`, `inventory`, `orders`, tüm `integrations/*` dahil). Kaldırmak platform genelinde
dağıtık izlemeyi kırar — bu görevin kapsamının çok ötesinde, ayrı bir OpenTelemetry geçiş
kararı gerektirir.

**Karar:** Şimdilik **aksiyon alınmadı**. `pnpm.overrides` ile `uuid`'yi zorla `11.1.1`'e
çekmek teknik olarak mümkün, ancak hem `exceljs` hem `jaeger-client`'ın iç `uuid`
kullanımını major sürüm atlatmak anlamına gelir (PR #75'te `multer` için kaçınılan aynı
risk sınıfı) ve karşılığında kapatılacak gerçek bir risk yok. Override lead onayı ve
davranışsal doğrulama (gerçek Excel dışa aktarma testi) olmadan uygulanmamalı.

**Yeniden değerlendirme koşulu:** `exceljs` veya `jaeger-client` yeni bir sürümde `v3/v5/v6`
kullanmaya başlarsa, ya da `jaeger-client` OpenTelemetry'ye geçiş kararıyla kaldırılırsa, bu
kayıt tekrar gözden geçirilmeli.
