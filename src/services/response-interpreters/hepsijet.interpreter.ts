import { OperationType } from '../../enums/operation-type.enum';
import { InterpretedResponse } from '../../models/integrationRequestLog.schema';
import { BaseResponseInterpreter } from './base.interpreter';
import { mapHepsiJetStatusToDeliveryStatus } from '../../common/enums/hepsijet-status.enum';
import { logger } from '../logger.service';

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
export class HepsiJetResponseInterpreter extends BaseResponseInterpreter {
    interpret(response: any, operationType: OperationType): InterpretedResponse | null {
        if (this.isEmptyResponse(response)) {
            return null;
        }

        try {
            switch (operationType) {
                case OperationType.CREATE_ORDER:
                    return this.interpretCreateShipment(response);

                case OperationType.CANCEL_ORDER:
                    return this.interpretCancelShipment(response);

                case OperationType.OTHER:
                    return this.interpretOtherOperation(response);

                default:
                    return this.interpretGeneric(response, operationType);
            }
        } catch (error) {
            logger.error('Error interpreting HepsiJet response', {
                operationType,
                error: (error as Error).message
            });
            return null;
        }
    }

    /**
     * createShipment yanitini yorumla.
     * Normal response: { data: { customerDeliveryNo, barcode, trackingUrl } }
     * veya direkt: { customerDeliveryNo, barcode, ... }
     */
    private interpretCreateShipment(response: any): InterpretedResponse {
        const data = response?.data || response;
        const customerDeliveryNo = data?.customerDeliveryNo || data?.deliveryNo;
        const barcode = data?.barcode || data?.trackingNumber;
        const trackingUrl = data?.trackingUrl;

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
    private interpretCancelShipment(response: any): InterpretedResponse {
        const success = response?.success !== false;
        const message = response?.message || (success ? 'Gonderi iptal edildi' : 'Iptal basarisiz');

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
    private interpretOtherOperation(response: any): InterpretedResponse {
        // Tracking response (tek veya coklu): { data: [{ customerDeliveryNo, status, ... }] } veya { data: {...} }
        const data = response?.data ?? response;

        if (Array.isArray(data) && data.length > 0 && data[0]?.customerDeliveryNo !== undefined) {
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
        if (data && typeof data === 'object' && (data.token || response?.token)) {
            return {
                summary: 'Auth token alindi',
                success: true,
                successCount: 1,
                failureCount: 0,
                details: { tokenAcquired: true },
                parsedAt: new Date()
            };
        }

        return this.interpretGeneric(response, OperationType.OTHER);
    }

    /**
     * Tek bir kargo takip yanitini yorumla.
     */
    private interpretTrackingSingle(item: any): InterpretedResponse {
        const deliveryStatus = mapHepsiJetStatusToDeliveryStatus(item?.status);
        const transactionCount = Array.isArray(item?.transactions) ? item.transactions.length : 0;

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
    private interpretTrackingBatch(items: any[]): InterpretedResponse {
        const deliveredCount = items.filter(i => mapHepsiJetStatusToDeliveryStatus(i?.status) === 'delivered').length;
        const inTransitCount = items.filter(i => mapHepsiJetStatusToDeliveryStatus(i?.status) === 'in_transit').length;
        const pendingCount = items.filter(i => mapHepsiJetStatusToDeliveryStatus(i?.status) === 'pending').length;
        const failedCount = items.filter(i => ['cancelled', 'returned', 'not_delivered'].includes(mapHepsiJetStatusToDeliveryStatus(i?.status))).length;

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
    private interpretGeneric(response: any, operationType: OperationType): InterpretedResponse {
        const success = !response?.error && response?.success !== false;

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
