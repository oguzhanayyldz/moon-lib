import { OperationType } from '../../enums/operation-type.enum';
import { InterpretedResponse } from '../../models/integrationRequestLog.schema';
import { BaseResponseInterpreter } from './base.interpreter';
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
export declare class HepsiJetResponseInterpreter extends BaseResponseInterpreter {
    interpret(response: any, operationType: OperationType): InterpretedResponse | null;
    /**
     * createShipment yanitini yorumla.
     * Normal response: { data: { customerDeliveryNo, barcode, trackingUrl } }
     * veya direkt: { customerDeliveryNo, barcode, ... }
     */
    private interpretCreateShipment;
    /**
     * cancelShipment yanitini yorumla.
     * Response: { success: true/false, message: "..." }
     */
    private interpretCancelShipment;
    /**
     * Diger operation'larin yorumlanmasi (tracking, batch tracking, label, auth).
     * HepsiJet'te cogu tracking ve label operasyonu OperationType.OTHER ile gidiyor.
     */
    private interpretOtherOperation;
    /**
     * Tek bir kargo takip yanitini yorumla.
     */
    private interpretTrackingSingle;
    /**
     * Coklu kargo takip yanitini yorumla (native batch tracking).
     */
    private interpretTrackingBatch;
    /**
     * Genel yanit yorumlama.
     */
    private interpretGeneric;
}
//# sourceMappingURL=hepsijet.interpreter.d.ts.map