/**
 * UC-2292 (UC-2225 tur 2) — `logResponse()` → `interpret(body, op, responseStatus)` bağı.
 * Üretimdeki asıl bağ: log servisi interpreter'a HTTP durumunu geçirmezse JSON gövdeli bir
 * HTTP 5xx yanıtı, tanınmayan gövde fallback'i yüzünden sessizce success:true yazılır.
 * (wafGuard testi yalnız HTML/engelleme dalını kapsar; bu test JSON gövde → interpreter dalını.)
 */
import { IntegrationRequestLogService } from '../integrationRequestLog.service';
import { OperationType } from '../../enums/operation-type.enum';
import { ResourceName } from '../../common';

function createFakeConnection(logEntry: any) {
    let capturedUpdate: any = null;
    const FakeModel = {
        findById(_id: string) {
            return Promise.resolve(logEntry);
        },
        findByIdAndUpdate(_id: string, updateData: any) {
            capturedUpdate = updateData;
            return Promise.resolve(null);
        }
    };
    return {
        connection: { model: () => FakeModel } as unknown as import('mongoose').Connection,
        getCapturedUpdate: () => capturedUpdate
    };
}

describe('IntegrationRequestLogService.logResponse — responseStatus interpreter\'a geçer (UC-2292 B1)', () => {
    it('Hepsiburada + JSON gövde + HTTP 500 → interpretedResponse.success=false', async () => {
        const logEntry = {
            id: 'log-hb-1',
            integrationName: ResourceName.Hepsiburada,
            operationType: OperationType.SEND_PRODUCTS,
            requestTime: new Date()
        };
        const { connection, getCapturedUpdate } = createFakeConnection(logEntry);
        const service = new IntegrationRequestLogService(connection);

        await service.logResponse('log-hb-1', {
            responseStatus: 500,
            responseBody: { message: 'Internal error' }
        });

        const interpreted = getCapturedUpdate().interpretedResponse;
        expect(interpreted.success).toBe(false);
        expect(interpreted.details?.responseStatus).toBe(500);
    });

    it('karşıt durum: aynı gövde + HTTP 200 → fallback success=true (bağ yalnız durum kodundan etkilenir)', async () => {
        const logEntry = {
            id: 'log-hb-2',
            integrationName: ResourceName.Hepsiburada,
            operationType: OperationType.SEND_PRODUCTS,
            requestTime: new Date()
        };
        const { connection, getCapturedUpdate } = createFakeConnection(logEntry);
        const service = new IntegrationRequestLogService(connection);

        await service.logResponse('log-hb-2', {
            responseStatus: 200,
            responseBody: { message: 'Internal error' }
        });

        expect(getCapturedUpdate().interpretedResponse.success).toBe(true);
    });
});
