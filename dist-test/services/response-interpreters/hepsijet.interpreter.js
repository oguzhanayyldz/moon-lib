"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HepsiJetResponseInterpreter = void 0;
const operation_type_enum_1 = require("../../enums/operation-type.enum");
const base_interpreter_1 = require("./base.interpreter");
const hepsijet_status_enum_1 = require("../../common/enums/hepsijet-status.enum");
const logger_service_1 = require("../logger.service");
/**
 * HepsiJet API yanitlarini yorumlayan interpreter.
 *
 * HepsiJet Response Formatlari:
 * - createShipment: { data: { customerDeliveryNo, barcode, trackingUrl } }
 * - trackShipment / fetchTrackingUpdatesBulk: { data: [{ customerDeliveryNo, status, statusDate, transactions: [...] }] }
 * - cancelShipment: { success: true, message: "..." }
 * - printLabel (PDF): { data: { labelUrl, pdfBase64 } }
 * - getAuthToken: { token: "..." }
 */
class HepsiJetResponseInterpreter extends base_interpreter_1.BaseResponseInterpreter {
    interpret(response, operationType) {
        if (this.isEmptyResponse(response)) {
            return null;
        }
        try {
            switch (operationType) {
                case operation_type_enum_1.OperationType.CREATE_ORDER:
                    return this.interpretCreateShipment(response);
                case operation_type_enum_1.OperationType.CANCEL_ORDER:
                    return this.interpretCancelShipment(response);
                case operation_type_enum_1.OperationType.OTHER:
                    return this.interpretOtherOperation(response);
                default:
                    return this.interpretGeneric(response, operationType);
            }
        }
        catch (error) {
            logger_service_1.logger.error('Error interpreting HepsiJet response', {
                operationType,
                error: error.message
            });
            return null;
        }
    }
    /**
     * createShipment yanitini yorumla.
     * Normal response: { data: { customerDeliveryNo, barcode, trackingUrl } }
     * veya direkt: { customerDeliveryNo, barcode, ... }
     */
    interpretCreateShipment(response) {
        const data = (response === null || response === void 0 ? void 0 : response.data) || response;
        const customerDeliveryNo = (data === null || data === void 0 ? void 0 : data.customerDeliveryNo) || (data === null || data === void 0 ? void 0 : data.deliveryNo);
        const barcode = (data === null || data === void 0 ? void 0 : data.barcode) || (data === null || data === void 0 ? void 0 : data.trackingNumber);
        const trackingUrl = data === null || data === void 0 ? void 0 : data.trackingUrl;
        const success = Boolean(customerDeliveryNo);
        return {
            summary: success
                ? `Gonderi olusturuldu: ${customerDeliveryNo}${barcode ? ` (barkod: ${barcode})` : ''}`
                : 'Gonderi olusturulamadi',
            success,
            successCount: success ? 1 : 0,
            failureCount: success ? 0 : 1,
            details: {
                customerDeliveryNo,
                barcode,
                trackingUrl
            },
            parsedAt: new Date()
        };
    }
    /**
     * cancelShipment yanitini yorumla.
     * Response: { success: true/false, message: "..." }
     */
    interpretCancelShipment(response) {
        const success = (response === null || response === void 0 ? void 0 : response.success) !== false;
        const message = (response === null || response === void 0 ? void 0 : response.message) || (success ? 'Gonderi iptal edildi' : 'Iptal basarisiz');
        return {
            summary: success ? `Gonderi iptal edildi${message ? `: ${message}` : ''}` : `Iptal basarisiz: ${message}`,
            success,
            successCount: success ? 1 : 0,
            failureCount: success ? 0 : 1,
            details: {
                message,
                raw: response
            },
            parsedAt: new Date()
        };
    }
    /**
     * Diger operation'larin yorumlanmasi (tracking, batch tracking, label, auth).
     * HepsiJet'te cogu tracking ve label operasyonu OperationType.OTHER ile gidiyor.
     */
    interpretOtherOperation(response) {
        var _a, _b;
        // Tracking response (tek veya coklu): { data: [{ customerDeliveryNo, status, ... }] } veya { data: {...} }
        const data = (_a = response === null || response === void 0 ? void 0 : response.data) !== null && _a !== void 0 ? _a : response;
        if (Array.isArray(data) && data.length > 0 && ((_b = data[0]) === null || _b === void 0 ? void 0 : _b.customerDeliveryNo) !== undefined) {
            return this.interpretTrackingBatch(data);
        }
        if (data && typeof data === 'object' && data.customerDeliveryNo !== undefined) {
            return this.interpretTrackingSingle(data);
        }
        // Label response: { labelUrl, pdfBase64 } veya ZPL string
        if (data && typeof data === 'object' && (data.labelUrl || data.pdfBase64)) {
            return {
                summary: `Etiket olusturuldu${data.labelUrl ? ` (URL mevcut)` : ''}${data.pdfBase64 ? ` (PDF base64 mevcut)` : ''}`,
                success: true,
                successCount: 1,
                failureCount: 0,
                details: {
                    hasLabelUrl: Boolean(data.labelUrl),
                    hasPdfBase64: Boolean(data.pdfBase64)
                },
                parsedAt: new Date()
            };
        }
        // Auth token response: { token: "..." }
        if (data && typeof data === 'object' && (data.token || (response === null || response === void 0 ? void 0 : response.token))) {
            return {
                summary: 'Auth token alindi',
                success: true,
                successCount: 1,
                failureCount: 0,
                details: { tokenAcquired: true },
                parsedAt: new Date()
            };
        }
        return this.interpretGeneric(response, operation_type_enum_1.OperationType.OTHER);
    }
    /**
     * Tek bir kargo takip yanitini yorumla.
     */
    interpretTrackingSingle(item) {
        const deliveryStatus = (0, hepsijet_status_enum_1.mapHepsiJetStatusToDeliveryStatus)(item === null || item === void 0 ? void 0 : item.status);
        const transactionCount = Array.isArray(item === null || item === void 0 ? void 0 : item.transactions) ? item.transactions.length : 0;
        return {
            summary: `Kargo takibi: ${item.customerDeliveryNo} -> ${deliveryStatus}${transactionCount > 0 ? ` (${transactionCount} hareket)` : ''}`,
            success: true,
            successCount: 1,
            failureCount: 0,
            details: {
                customerDeliveryNo: item.customerDeliveryNo,
                rawStatus: item.status,
                deliveryStatus,
                transactionCount,
                lastStatusDate: item.statusDate || item.lastStatusDate
            },
            parsedAt: new Date()
        };
    }
    /**
     * Coklu kargo takip yanitini yorumla (native batch tracking).
     */
    interpretTrackingBatch(items) {
        const deliveredCount = items.filter(i => (0, hepsijet_status_enum_1.mapHepsiJetStatusToDeliveryStatus)(i === null || i === void 0 ? void 0 : i.status) === 'delivered').length;
        const inTransitCount = items.filter(i => (0, hepsijet_status_enum_1.mapHepsiJetStatusToDeliveryStatus)(i === null || i === void 0 ? void 0 : i.status) === 'in_transit').length;
        const pendingCount = items.filter(i => (0, hepsijet_status_enum_1.mapHepsiJetStatusToDeliveryStatus)(i === null || i === void 0 ? void 0 : i.status) === 'pending').length;
        const failedCount = items.filter(i => ['cancelled', 'returned', 'not_delivered'].includes((0, hepsijet_status_enum_1.mapHepsiJetStatusToDeliveryStatus)(i === null || i === void 0 ? void 0 : i.status))).length;
        return {
            summary: `Toplu kargo takibi (${items.length} adet): ${deliveredCount} teslim, ${inTransitCount} yolda, ${pendingCount} beklemede${failedCount > 0 ? `, ${failedCount} basarisiz` : ''}`,
            success: true,
            successCount: items.length - failedCount,
            failureCount: failedCount,
            details: {
                total: items.length,
                delivered: deliveredCount,
                inTransit: inTransitCount,
                pending: pendingCount,
                failed: failedCount
            },
            parsedAt: new Date()
        };
    }
    /**
     * Genel yanit yorumlama.
     */
    interpretGeneric(response, operationType) {
        const success = !(response === null || response === void 0 ? void 0 : response.error) && (response === null || response === void 0 ? void 0 : response.success) !== false;
        return {
            summary: `HepsiJet ${operationType} islemi ${success ? 'tamamlandi' : 'basarisiz'}`,
            success,
            successCount: success ? 1 : 0,
            failureCount: success ? 0 : 1,
            details: {
                responseType: typeof response,
                hasData: !this.isEmptyResponse(response)
            },
            parsedAt: new Date()
        };
    }
}
exports.HepsiJetResponseInterpreter = HepsiJetResponseInterpreter;
//# sourceMappingURL=hepsijet.interpreter.js.map