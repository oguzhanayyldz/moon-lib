/**
 * TASK-MUDY1TB6EDJAJ — `logResponse()`, `interpret()`'e `responseStatus`'u hiç
 * geçmiyordu. Platform interpreter'larının "tanınmayan gövde" fallback'i
 * koşulsuz `success:true` döndüğünden, bir WAF/engelleme sayfası (örn.
 * Cloudflare "Attention Required!" HTML'i, 403 ile) sessizce başarılı
 * işaretleniyordu. Düzeltme, interpreter'ı çağırmadan önce hata durum kodu +
 * JSON olmayan gövde şeklini tespit edip deterministik bir `success:false`
 * üretiyor; 200 + tanınmayan JSON şekli davranışı (bilinçli sınır, kapsam
 * dışı) değişmeden kalıyor.
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

const CLOUDFLARE_BLOCK_HTML = `<!DOCTYPE html><html><head><title>Attention Required! | Cloudflare</title></head><body>Sorry, you have been blocked</body></html>`;

describe('IntegrationRequestLogService.logResponse — WAF/engelleme guard', () => {
    it('Cloudflare engelleme HTML + 403 alındığında interpretedResponse.success=false olur (koşulsuz success:true dönmez)', async () => {
        const logEntry = {
            id: 'log-1',
            integrationName: ResourceName.Trendyol,
            operationType: OperationType.SEND_PRODUCTS,
            requestTime: new Date()
        };
        const { connection, getCapturedUpdate } = createFakeConnection(logEntry);
        const service = new IntegrationRequestLogService(connection);

        await service.logResponse('log-1', {
            responseStatus: 403,
            responseBody: CLOUDFLARE_BLOCK_HTML as any
        });

        const updateData = getCapturedUpdate();
        expect(updateData.interpretedResponse.success).toBe(false);
        expect(updateData.interpretedResponse.failureCount).toBe(1);
    });

    it('genel bir HTML hata sayfası + 500 için de success=false üretir (yalnız Cloudflare\'a özel değil)', async () => {
        const logEntry = {
            id: 'log-2',
            integrationName: ResourceName.Trendyol,
            operationType: OperationType.SEND_PRODUCTS,
            requestTime: new Date()
        };
        const { connection, getCapturedUpdate } = createFakeConnection(logEntry);
        const service = new IntegrationRequestLogService(connection);

        await service.logResponse('log-2', {
            responseStatus: 500,
            responseBody: '<html><body>Internal Server Error</body></html>' as any
        });

        expect(getCapturedUpdate().interpretedResponse.success).toBe(false);
    });

    it('200 + tanınmayan JSON şekli davranışı DEĞİŞMEZ: mevcut fallback success=true kalır (bilinçli sınır)', async () => {
        const logEntry = {
            id: 'log-3',
            integrationName: ResourceName.Trendyol,
            operationType: OperationType.SEND_PRODUCTS,
            requestTime: new Date()
        };
        const { connection, getCapturedUpdate } = createFakeConnection(logEntry);
        const service = new IntegrationRequestLogService(connection);

        await service.logResponse('log-3', {
            responseStatus: 200,
            responseBody: { unknownShape: 'no batchRequestId, no items' }
        });

        expect(getCapturedUpdate().interpretedResponse.success).toBe(true);
    });

    it('bodyPreview ham gövde değil maskeli gövdeden üretilir (token/password/authorization sızmaz)', async () => {
        const logEntry = {
            id: 'log-4',
            integrationName: ResourceName.Trendyol,
            operationType: OperationType.SEND_PRODUCTS,
            requestTime: new Date()
        };
        const { connection, getCapturedUpdate } = createFakeConnection(logEntry);
        const service = new IntegrationRequestLogService(connection);

        await service.logResponse('log-4', {
            responseStatus: 403,
            responseBody: '<html>{"token":"tok-SECRET-1","password":"pw-SECRET-2","authorization":"Bearer auth-SECRET-3"}</html>' as any
        });

        const updateData = getCapturedUpdate();
        const preview = updateData.interpretedResponse.details.bodyPreview;
        expect(updateData.interpretedResponse.success).toBe(false);
        expect(preview).not.toContain('tok-SECRET-1');
        expect(preview).not.toContain('pw-SECRET-2');
        expect(preview).not.toContain('auth-SECRET-3');
        expect(preview).toBe(String(updateData.responseBody).slice(0, 300));
    });

    it('200 + gövdede "cloudflare" geçen düz metin engelleme sayılmaz (yalnız status>=300)', async () => {
        const logEntry = {
            id: 'log-5',
            integrationName: ResourceName.Trendyol,
            operationType: OperationType.SEND_PRODUCTS,
            requestTime: new Date()
        };
        const { connection, getCapturedUpdate } = createFakeConnection(logEntry);
        const service = new IntegrationRequestLogService(connection);

        await service.logResponse('log-5', {
            responseStatus: 200,
            responseBody: 'served via cloudflare edge, all good' as any
        });

        const details = getCapturedUpdate().interpretedResponse?.details;
        expect(details?.bodyPreview).toBeUndefined();
    });
});
