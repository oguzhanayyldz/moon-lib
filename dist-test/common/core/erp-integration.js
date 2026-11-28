"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErpIntegration = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
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
     * Stokları sayfa sayfa çeker; her sayfayı her stok hedefi için `ProductStockIntegrationUpdated` olarak
     * Outbox'a yazar (ikas deseni). inventory eşler, kuralları uygular, pazaryerlerine yayar.
     */
    async fetchStocks(params) {
        var _a, _b;
        if (!this.supportsCatalogFetch()) {
            logger_service_1.logger.info(`${this.constructor.name}: fetchStocks not supported (listCatalogPage yok)`);
            return integration_commands_1.UNSUPPORTED_COMMAND_RESPONSE;
        }
        const targets = this.resolveStockTargets();
        if (targets.length === 0) {
            logger_service_1.logger.warn(`${this.constructor.name}: stok kaynağı/hedef depo yok, stok çekilmedi`, { user: (_a = this.credentials) === null || _a === void 0 ? void 0 : _a.user });
            return { success: false, message: 'errors.integration.erp.noStockSource' };
        }
        const platform = this.resolvePlatform();
        const query = this.toQuery(params);
        let rows = 0;
        let events = 0;
        const pages = await this.walkCatalog(query, async (items) => {
            // ORTA-3: açık sipariş adedi toplamda bir kez düşülür → yalnız ilk (birincil) hedef düşer.
            let primaryTargetPending = true;
            for (const target of targets) {
                const stockRows = (0, erp_catalog_util_1.buildErpStockRows)(items, target);
                if (stockRows.length === 0)
                    continue;
                const skipOpenOrderDeduction = !primaryTargetPending;
                primaryTargetPending = false;
                await this.writeOutboxEvent(subjects_1.Subjects.ProductStockIntegrationUpdated, Object.assign(Object.assign({ requestId: (0, uuid_1.v4)(), userId: this.credentials.user, data: stockRows, source: platform, sourceType: integration_type_1.IntegrationType.Erp }, (skipOpenOrderDeduction ? { skipOpenOrderDeduction: true } : {})), { timestamp: new Date() }));
                rows += stockRows.length;
                events++;
            }
        });
        logger_service_1.logger.info(`${this.constructor.name}: ERP stok çekme bitti`, { pages, rows, events, user: (_b = this.credentials) === null || _b === void 0 ? void 0 : _b.user });
        return { success: true, data: { pages, rows, events } };
    }
    /**
     * Fiyatları sayfa sayfa çeker ve `ProductPriceIntegrationFetched` olarak yayınlar (B4: istek/yanıt YOK,
     * 30 sn sınırı yok). Fiyat KDV dahildir (B6); kurallar ve kur dönüşümü integration dinleyicisinde.
     */
    async fetchPrices(params) {
        var _a;
        if (!this.supportsCatalogFetch()) {
            logger_service_1.logger.info(`${this.constructor.name}: fetchPrices not supported (listCatalogPage yok)`);
            return integration_commands_1.UNSUPPORTED_COMMAND_RESPONSE;
        }
        const platform = this.resolvePlatform();
        const processId = (params === null || params === void 0 ? void 0 : params.processId) || (0, uuid_1.v4)();
        const query = this.toQuery(params);
        let rows = 0;
        let events = 0;
        const pages = await this.walkCatalog(query, async (items, pageIndex, isLastPage, startedAt) => {
            var _a;
            const priceRows = (0, erp_catalog_util_1.buildErpPriceRows)(items, platform);
            // DÜŞÜK-1: son sayfa süzgeçten sonra boş kalsa da `isLastPage:true` taşıyan olay gider
            // (tüketicinin kilidi/tamamlanma sinyali buna bağlı); boş kalem listesi tüketicide tolere edilir.
            if (priceRows.length === 0 && !isLastPage)
                return;
            await this.writeOutboxEvent(subjects_1.Subjects.ProductPriceIntegrationFetched, {
                requestId: `${processId}:${platform}:p${pageIndex}`,
                processId,
                userId: this.credentials.user,
                integrationId: ((_a = this.credentials) === null || _a === void 0 ? void 0 : _a.integrationId) ? String(this.credentials.integrationId) : undefined,
                source: platform,
                pageIndex,
                isLastPage,
                data: priceRows,
                timestamp: startedAt
            });
            rows += priceRows.length;
            events++;
        });
        logger_service_1.logger.info(`${this.constructor.name}: ERP fiyat çekme bitti`, { pages, rows, events, processId, user: (_a = this.credentials) === null || _a === void 0 ? void 0 : _a.user });
        return { success: true, data: { pages, rows, events, processId } };
    }
    /** ERP depo listesi (stok kaynağı ayarında `sourceLocationId` seçimi için). */
    async fetchLocations() {
        if (typeof this.listLocations !== 'function') {
            return integration_commands_1.UNSUPPORTED_COMMAND_RESPONSE;
        }
        const locations = await this.listLocations();
        return { success: true, data: locations || [] };
    }
    /**
     * Kataloğu baştan sona dolaşır; her sayfa için `onPage` çağrılır. Dönüş: okunan sayfa sayısı.
     * `next` daha önce görülmüş bir imleci tekrar ederse (art arda ya da A→B→A) ya da `maxCatalogPages` aşılırsa durur (sonsuz döngü koruması).
     */
    async walkCatalog(query, onPage) {
        let cursor = undefined;
        let pageIndex = 0;
        // DÜŞÜK-2: yalnız art arda değil A→B→A döngüsünü de yakalamak için görülen tüm imleçler tutulur.
        const seenCursors = new Set();
        while (pageIndex < this.maxCatalogPages) {
            pageIndex++;
            const startedAt = new Date();
            const page = await this.listCatalogPage(cursor, query);
            const items = ((page === null || page === void 0 ? void 0 : page.items) || []).filter(item => (0, erp_catalog_util_1.matchesErpQuery)(item, query));
            const next = page === null || page === void 0 ? void 0 : page.next;
            const nextKey = next === undefined || next === null || next === '' ? null : JSON.stringify(next);
            if (cursor !== undefined && cursor !== null)
                seenCursors.add(JSON.stringify(cursor));
            const isLastPage = nextKey === null || next === cursor || seenCursors.has(nextKey);
            await onPage(items, pageIndex, isLastPage, startedAt);
            if (isLastPage)
                return pageIndex;
            cursor = next;
        }
        logger_service_1.logger.warn(`${this.constructor.name}: katalog sayfa sınırına (${this.maxCatalogPages}) ulaşıldı, çekme kesildi`);
        return pageIndex;
    }
    /**
     * Kullanıcının stok kaynağı ayarından BU entegrasyonun etkin hedefleri.
     * Ayar düz metin (JSON) gelebilir; başka entegrasyonun kaynağı (integrationId farklı) alınmaz.
     */
    resolveStockTargets() {
        var _a, _b;
        let settings = (_a = this.credentials) === null || _a === void 0 ? void 0 : _a.stock_update_settings;
        if (typeof settings === 'string') {
            try {
                settings = JSON.parse(settings);
            }
            catch (_c) {
                settings = null;
            }
        }
        const ownId = ((_b = this.credentials) === null || _b === void 0 ? void 0 : _b.integrationId) ? String(this.credentials.integrationId) : null;
        const sources = Array.isArray(settings === null || settings === void 0 ? void 0 : settings.sources) ? settings.sources : [];
        return sources
            .filter(s => s && s.enabled && s.warehouseId)
            .filter(s => !ownId || !s.integrationId || String(s.integrationId) === ownId)
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
    /** Olayı servisin Outbox'ına yazar (testte taklit edilebilir). */
    async writeOutboxEvent(eventType, payload) {
        const Outbox = (0, outbox_schema_1.createOutboxModel)(mongoose_1.default.connection);
        const outbox = Outbox.build({ eventType, payload, status: 'pending' });
        await optimisticLocking_util_1.OptimisticLockingUtil.saveWithRetry(outbox);
    }
}
exports.ErpIntegration = ErpIntegration;
//# sourceMappingURL=erp-integration.js.map