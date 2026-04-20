"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoryChangeSource = void 0;
/**
 * Entity tarihçe kaydi (ProductHistory, CatalogMappingHistory) degisimlerinin kaynagi.
 * Fiyat/stok gecmisleri kendi source enum'larini kullanir (PriceChangeSource, StockActionType).
 */
var HistoryChangeSource;
(function (HistoryChangeSource) {
    HistoryChangeSource["Manual"] = "MANUAL";
    HistoryChangeSource["Integration"] = "INTEGRATION";
    HistoryChangeSource["Automation"] = "AUTOMATION";
    HistoryChangeSource["System"] = "SYSTEM";
    HistoryChangeSource["Excel"] = "EXCEL";
    HistoryChangeSource["Api"] = "API"; // Direct API call (3P)
})(HistoryChangeSource || (exports.HistoryChangeSource = HistoryChangeSource = {}));
