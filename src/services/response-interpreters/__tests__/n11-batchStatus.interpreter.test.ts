/**
 * TASK-MUL54GFH5NS33 (N1) — n11Batch.service.ts `checkBatchStatus`'un IntegrationRequestLog'a
 * yazdığı özet gövdesi ({ status, summary:{total,success,failed}, successItems, failedItems }),
 * Trendyol/İdefix ile aynı şekildedir; ham N11 task-details cevabı ({ skus:{content:[...]} }) DEĞİL.
 * Düzeltme öncesi: interpretTaskDetails yalnız `skus.content`'i okuyordu (hiç dolmuyor) → hep 0/0.
 */
import { OperationType } from '../../../enums/operation-type.enum';
import { N11ResponseInterpreter } from '../n11.interpreter';

const BATCH_SUMMARY_BODY = {
    batchRequestId: 'batch-1',
    status: 'PARTIAL',
    summary: { total: 5, success: 3, failed: 2 },
    successItems: [{ stockCode: 'SKU-1', status: 'SUCCESS' }],
    failedItems: [
        { stockCode: 'SKU-2', errors: ['Fiyat kilidi'] },
        { stockCode: 'SKU-3', errors: ['Stok yetersiz'] }
    ],
    attempts: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:10:00.000Z'
};

describe('N11ResponseInterpreter.interpret(GET_BATCH_STATUS) — özet gövdesi', () => {
    it('gerçek {summary,successItems,failedItems} gövdesinden doğru sayıları üretir (eski davranış: skus.content boş olduğu için hep 0/0)', () => {
        const interpreter = new N11ResponseInterpreter();
        const result = interpreter.interpret(BATCH_SUMMARY_BODY, OperationType.GET_BATCH_STATUS);

        expect(result).not.toBeNull();
        expect(result!.successCount).toBe(3);
        expect(result!.failureCount).toBe(2);
        expect(result!.success).toBe(false);
        expect(result!.details?.failedItems).toHaveLength(2);
    });

    it('ham {skus:{content:[...]}} gövdesi hâlâ geriye dönük çalışır (savunma amaçlı yol)', () => {
        const interpreter = new N11ResponseInterpreter();
        const result = interpreter.interpret(
            { status: 'PROCESSED', skus: { content: [{ itemCode: 'A', status: 'SUCCESS' }, { itemCode: 'B', status: 'FAIL' }] } },
            OperationType.GET_BATCH_STATUS
        );
        expect(result!.successCount).toBe(1);
        expect(result!.failureCount).toBe(1);
    });

    it('status:COMPLETED ama summary.failed>0 ise özet "kısmen" içerir (sayaç, status\'tan önceliklidir)', () => {
        const interpreter = new N11ResponseInterpreter();
        const result = interpreter.interpret(
            { status: 'COMPLETED', summary: { total: 3, success: 2, failed: 1 } },
            OperationType.GET_BATCH_STATUS
        );

        expect(result!.summary).toContain('kısmen');
        expect(result!.success).toBe(false);
        expect(result!.details?.status).toBe('partial');
    });
});
