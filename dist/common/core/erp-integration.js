"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErpIntegration = void 0;
const uuid_1 = require("uuid");
const integration_type_1 = require("../types/integration-type");
const base_integration_1 = require("./base-integration");
const subjects_1 = require("../events/subjects");
const integration_commands_1 = require("../constants/integration-commands");
const erp_catalog_util_1 = require("./erp-catalog.util");
const outbox_schema_1 = require("../../models/outbox.schema");
const optimisticLocking_util_1 = require("../../utils/optimisticLocking.util");
const logger_service_1 = require("../../services/logger.service");
/**
 * ERP Integration Base Class
 *
 * ERP (Enterprise Resource Planning) entegrasyonları için temel sınıf.
 * Marketplace ve E-commerce entegrasyonlarından farklı olarak:
 * - Siparişleri çekmek yerine ERP'ye gönderir (fatura kesme)
 * - Ürün/stok kartı senkronizasyonu
 * - Cari (müşteri/tedarikçi) yönetimi
 * - Fatura resmileştirme işlemleri (e-Arşiv, e-Fatura)
 *
 * @abstract
 * @extends BaseIntegration
 */
class ErpIntegration extends base_integration_1.BaseIntegration {
    constructor() {
        super();
        /** Sonsuz sayfalama koruması (ERP hep `next` dönerse). */
        this.maxCatalogPages = 5000;
        this.type = integration_type_1.IntegrationType.Erp;
    }
    /** ERP stok/fiyat çekmeyi destekliyor mu (eşleyici yazılmış mı). */
    supportsCatalogFetch() {
        return typeof this.listCatalogPage === 'function';
    }
    /**
     * Stokları sayfa sayfa çeker ve her etkin kaynak (depo/raf) için AYRI `ProductStockIntegrationUpdated`
     * olayı yayınlar (ikas/Shopify/Trendyol deseni: kaynak başına olay, `requestId` olay başına benzersiz).
     * Ayar kapısı pazaryeriyle aynı: `stock_update_settings.enabled` kapalıysa hata, etkin kaynak yoksa `sources[0]` yedeği.
     */
    fetchStocks(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            if (!this.supportsCatalogFetch()) {
                logger_service_1.logger.info(`${this.constructor.name}: fetchStocks not supported (listCatalogPage yok)`);
                return integration_commands_1.UNSUPPORTED_COMMAND_RESPONSE;
            }
            if (!((_b = (_a = this.credentials) === null || _a === void 0 ? void 0 : _a.stock_update_settings) === null || _b === void 0 ? void 0 : _b.enabled)) {
                throw new Error('Product stocks fetching is not active. Please enable it in the credentials.');
            }
            const targets = this.resolveStockTargets();
            if (targets.length === 0) {
                throw new Error('No sources configured for stock fetching');
            }
            const platform = this.resolvePlatform();
            const query = this.toQuery(params);
            let rows = 0;
            let events = 0;
            const pages = yield this.walkCatalog(query, (items) => __awaiter(this, void 0, void 0, function* () {
                for (const target of targets) {
                    const stockRows = (0, erp_catalog_util_1.buildErpStockRows)(items, target);
                    if (stockRows.length === 0)
                        continue;
                    yield this.writeOutboxEvent(subjects_1.Subjects.ProductStockIntegrationUpdated, {
                        requestId: (0, uuid_1.v4)(),
                        userId: this.credentials.user,
                        data: stockRows,
                        source: platform,
                        timestamp: new Date()
                    });
                    rows += stockRows.length;
                    events++;
                }
            }));
            logger_service_1.logger.info(`${this.constructor.name}: ERP stok çekme bitti`, { pages, rows, events, user: (_c = this.credentials) === null || _c === void 0 ? void 0 : _c.user });
            return { success: true, data: { pages, rows, events } };
        });
    }
    /**
     * Fiyatları pazaryeriyle AYNI biçimde döner: istek/yanıt, `ProductPriceIntegrationUpdated[]` (kayıt yoksa null).
     * Kural, kur ve strateji `priceUpdateService` / pricing'de uygulanır; ERP için ayrı olay/kilit yoktur.
     */
    fetchPrices(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            if (!this.supportsCatalogFetch()) {
                logger_service_1.logger.info(`${this.constructor.name}: fetchPrices not supported (listCatalogPage yok)`);
                return integration_commands_1.UNSUPPORTED_COMMAND_RESPONSE;
            }
            if (!((_b = (_a = this.credentials) === null || _a === void 0 ? void 0 : _a.price_update_settings) === null || _b === void 0 ? void 0 : _b.enabled)) {
                throw new Error('Product price fetching is not active. Please enable it in the credentials.');
            }
            const platform = this.resolvePlatform();
            const query = this.toQuery(params);
            const prices = [];
            yield this.walkCatalog(query, (items) => __awaiter(this, void 0, void 0, function* () {
                prices.push(...(0, erp_catalog_util_1.buildErpPriceRows)(items, platform));
            }));
            logger_service_1.logger.info(`${this.constructor.name}: ERP fiyat çekme bitti`, { rows: prices.length, user: (_c = this.credentials) === null || _c === void 0 ? void 0 : _c.user });
            return prices.length > 0 ? prices : null;
        });
    }
    /** ERP depo listesi (stok kaynağı ayarında `sourceLocationId` seçimi için). */
    fetchLocations() {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof this.listLocations !== 'function') {
                return integration_commands_1.UNSUPPORTED_COMMAND_RESPONSE;
            }
            const locations = yield this.listLocations();
            return { success: true, data: locations || [] };
        });
    }
    /**
     * Kataloğu baştan sona dolaşır; her sayfa için `onPage` çağrılır. Dönüş: okunan sayfa sayısı.
     * `next` daha önce görülmüş bir imleci tekrar ederse (art arda ya da A→B→A) ya da `maxCatalogPages` aşılırsa durur (sonsuz döngü koruması).
     */
    walkCatalog(query, onPage) {
        return __awaiter(this, void 0, void 0, function* () {
            let cursor = undefined;
            let pageIndex = 0;
            // DÜŞÜK-2: yalnız art arda değil A→B→A döngüsünü de yakalamak için görülen tüm imleçler tutulur.
            const seenCursors = new Set();
            while (pageIndex < this.maxCatalogPages) {
                pageIndex++;
                const startedAt = new Date();
                const page = yield this.listCatalogPage(cursor, query);
                const items = ((page === null || page === void 0 ? void 0 : page.items) || []).filter(item => (0, erp_catalog_util_1.matchesErpQuery)(item, query));
                const next = page === null || page === void 0 ? void 0 : page.next;
                const nextKey = next === undefined || next === null || next === '' ? null : JSON.stringify(next);
                if (cursor !== undefined && cursor !== null)
                    seenCursors.add(JSON.stringify(cursor));
                const isLastPage = nextKey === null || next === cursor || seenCursors.has(nextKey);
                yield onPage(items, pageIndex, isLastPage, startedAt);
                if (isLastPage)
                    return pageIndex;
                cursor = next;
            }
            logger_service_1.logger.warn(`${this.constructor.name}: katalog sayfa sınırına (${this.maxCatalogPages}) ulaşıldı, çekme kesildi`);
            return pageIndex;
        });
    }
    /**
     * Stok kaynağı ayarından etkin hedefler. Ayar `CredentialsService` tarafından bu entegrasyonun
     * kaynağına süzülmüş gelir; etkin kaynak yoksa pazaryeri gibi `sources[0]` yedeği kullanılır.
     */
    resolveStockTargets() {
        var _a, _b;
        const sources = Array.isArray((_b = (_a = this.credentials) === null || _a === void 0 ? void 0 : _a.stock_update_settings) === null || _b === void 0 ? void 0 : _b.sources)
            ? this.credentials.stock_update_settings.sources
            : [];
        let chosen = sources.filter(s => s && s.enabled);
        if (chosen.length === 0 && sources[0])
            chosen = [sources[0]];
        return chosen
            .filter(s => s.warehouseId)
            .map(s => ({ warehouseId: String(s.warehouseId), shelfId: s.shelfId || null, sourceLocationId: s.sourceLocationId || null }));
    }
    resolvePlatform() {
        var _a;
        return (((_a = this.credentials) === null || _a === void 0 ? void 0 : _a.platform) || this.platform);
    }
    toQuery(params) {
        if (!params || (!params.sku && !params.barcode))
            return undefined;
        return Object.assign(Object.assign({}, (params.sku ? { sku: params.sku } : {})), (params.barcode ? { barcode: params.barcode } : {}));
    }
    /**
     * UC-2619F (Y1) — servis startup'ında çağrılır: Outbox'a SERVİSİN kendi mongoose bağlantısıyla yazılır.
     * moon-lib'in kendi `mongoose` örneği (dev imajında ayrı node_modules) bağlanmamış olabilir; bu yüzden
     * `AuthFailureTracker.initialize` / `EventPublisherJob(…, connection)` kalıbıyla bağlantı dışarıdan verilir.
     */
    static initializeOutbox(connection) {
        ErpIntegration.outboxConnection = connection;
    }
    /** Olayı servisin Outbox'ına, enjekte edilen bağlantıyla yazar (testte taklit edilebilir). Bağlantı yoksa AÇIK hata verir. */
    writeOutboxEvent(eventType, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const connection = ErpIntegration.outboxConnection;
            if (!connection) {
                throw new Error('ErpIntegration.initializeOutbox(mongoose.connection) çağrılmadı: ERP stok olayı Outbox\'a yazılamaz');
            }
            const Outbox = (0, outbox_schema_1.createOutboxModel)(connection);
            const outbox = Outbox.build({ eventType, payload, status: 'pending' });
            yield optimisticLocking_util_1.OptimisticLockingUtil.saveWithRetry(outbox);
        });
    }
}
exports.ErpIntegration = ErpIntegration;
