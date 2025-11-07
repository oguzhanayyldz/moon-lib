"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperationType = void 0;
/**
 * Integration işlemlerinin türlerini belirten enum
 * Log kayıtlarının kategorize edilmesi ve filtrelenmesi için kullanılır
 */
var OperationType;
(function (OperationType) {
    // Ürün İşlemleri
    OperationType["SEND_PRODUCTS"] = "SEND_PRODUCTS";
    OperationType["FETCH_PRODUCTS"] = "FETCH_PRODUCTS";
    OperationType["UPDATE_PRODUCTS"] = "UPDATE_PRODUCTS";
    OperationType["DELETE_PRODUCTS"] = "DELETE_PRODUCTS";
    OperationType["CHECK_PRODUCT_STATUS"] = "CHECK_PRODUCT_STATUS";
    // Batch İşlemleri
    OperationType["GET_BATCH_STATUS"] = "GET_BATCH_STATUS";
    OperationType["CREATE_BATCH_REQUEST"] = "CREATE_BATCH_REQUEST";
    // Kategori ve Marka İşlemleri
    OperationType["GET_CATEGORIES"] = "GET_CATEGORIES";
    OperationType["GET_BRANDS"] = "GET_BRANDS";
    OperationType["GET_CATEGORY_ATTRIBUTES"] = "GET_CATEGORY_ATTRIBUTES";
    // Stok İşlemleri
    OperationType["CHECK_STOCK"] = "CHECK_STOCK";
    OperationType["UPDATE_STOCK"] = "UPDATE_STOCK";
    OperationType["SYNC_STOCK"] = "SYNC_STOCK";
    OperationType["UPDATE_STOCK_AND_PRICE"] = "UPDATE_STOCK_AND_PRICE";
    // Sipariş İşlemleri
    OperationType["CREATE_ORDER"] = "CREATE_ORDER";
    OperationType["UPDATE_ORDER"] = "UPDATE_ORDER";
    OperationType["CANCEL_ORDER"] = "CANCEL_ORDER";
    OperationType["FETCH_ORDERS"] = "FETCH_ORDERS";
    // Fiyat İşlemleri
    OperationType["UPDATE_PRICES"] = "UPDATE_PRICES";
    OperationType["FETCH_PRICES"] = "FETCH_PRICES";
    // Diğer İşlemler
    OperationType["HEALTH_CHECK"] = "HEALTH_CHECK";
    OperationType["OTHER"] = "OTHER";
})(OperationType || (exports.OperationType = OperationType = {}));
//# sourceMappingURL=operation-type.enum.js.map