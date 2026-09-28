/**
 * TASK-MUL54GFH5NS33 — trendyolBatch.service/idefixBatch.service'in `processBatchResults`'ta
 * IntegrationRequestLog'a yazdığı ÖZET gövdesi ({ status, summary:{total,success,failed},
 * successItems, failedItems }) — ham platform API cevabı DEĞİL. İnterpret() bu gövdeyi alır
 * (integrationRequestLog.service.ts: `interpreter.interpret(options.responseBody, ...)`).
 * Düzeltme öncesi: Trendyol `response?.items` arıyordu (hiç dolmuyor) → hep 0/0.
 * İdefix'in ise factory'de hiç case'i yoktu → interpret() hiç çağrılmıyordu.
 */
import { OperationType } from '../../../enums/operation-type.enum';
import { ResourceName } from '../../../common';
import { TrendyolResponseInterpreter } from '../trendyol.interpreter';
import { IdefixResponseInterpreter } from '../idefix.interpreter';
import { ResponseInterpreterFactory } from '../interpreter.factory';

const BATCH_SUMMARY_BODY = {
    batchRequestId: 'batch-1',
    status: 'PARTIAL',
    summary: { total: 5, success: 3, failed: 2 },
    successItems: [{ barcode: 'SKU-1', status: 'SUCCESS' }],
    failedItems: [
        { barcode: 'SKU-2', errors: ['Fiyat kilidi'] },
        { barcode: 'SKU-3', errors: ['Stok yetersiz'] }
    ],
    attempts: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:10:00.000Z'
};

describe('TrendyolResponseInterpreter.interpret(GET_BATCH_STATUS) — özet gövdesi', () => {
    it('gerçek {summary,successItems,failedItems} gövdesinden doğru sayıları üretir (eski davranış: her zaman 0/0)', () => {
        const interpreter = new TrendyolResponseInterpreter();
        const result = interpreter.interpret(BATCH_SUMMARY_BODY, OperationType.GET_BATCH_STATUS);

        expect(result).not.toBeNull();
        expect(result!.successCount).toBe(3);
        expect(result!.failureCount).toBe(2);
        expect(result!.success).toBe(false);
        expect(result!.details?.failedItems).toHaveLength(2);
    });

    it('ham {items:[...]} gövdesi hâlâ geriye dönük çalışır (savunma amaçlı yol)', () => {
        const interpreter = new TrendyolResponseInterpreter();
        const result = interpreter.interpret(
            { items: [{ status: 'SUCCESS' }, { status: 'FAILED' }] },
            OperationType.GET_BATCH_STATUS
        );
        expect(result!.successCount).toBe(1);
        expect(result!.failureCount).toBe(1);
    });

    it('status:COMPLETED ama summary.failed>0 ise özet "kısmen" içerir (sayaç, status\'tan önceliklidir)', () => {
        const interpreter = new TrendyolResponseInterpreter();
        const result = interpreter.interpret(
            { status: 'COMPLETED', summary: { total: 3, success: 2, failed: 1 } },
            OperationType.GET_BATCH_STATUS
        );

        expect(result!.summary).toContain('kısmen');
        expect(result!.success).toBe(false);
        expect(result!.details?.status).toBe('partial');
    });
});

describe('IdefixResponseInterpreter.interpret(GET_BATCH_STATUS) — daha önce hiç yoktu', () => {
    it('factory artık Idefix için bu interpreter\'ı döndürüyor', () => {
        const interpreter = ResponseInterpreterFactory.getInterpreter(ResourceName.Idefix);
        expect(interpreter).toBeInstanceOf(IdefixResponseInterpreter);
    });

    it('özet gövdesinden doğru sayıları üretir (eski davranış: interpreter yok → interpretedResponse hep null)', () => {
        const interpreter = new IdefixResponseInterpreter();
        const result = interpreter.interpret(BATCH_SUMMARY_BODY, OperationType.GET_BATCH_STATUS);

        expect(result).not.toBeNull();
        expect(result!.successCount).toBe(3);
        expect(result!.failureCount).toBe(2);
        expect(result!.details?.status).toBe('partial');
    });

    it('SEND_PRODUCTS için batchRequestId tabanlı özet üretir', () => {
        const interpreter = new IdefixResponseInterpreter();
        const result = interpreter.interpret({ batchRequestId: 'b-2', itemCount: 10 }, OperationType.SEND_PRODUCTS);

        expect(result!.success).toBe(true);
        expect(result!.successCount).toBe(10);
    });

    it('status:COMPLETED ama summary.failed>0 ise özet "kısmen" içerir (sayaç, status\'tan önceliklidir)', () => {
        const interpreter = new IdefixResponseInterpreter();
        const result = interpreter.interpret(
            { status: 'COMPLETED', summary: { total: 3, success: 2, failed: 1 } },
            OperationType.GET_BATCH_STATUS
        );

        expect(result!.summary).toContain('kısmen');
        expect(result!.success).toBe(false);
        expect(result!.details?.status).toBe('partial');
    });
});
