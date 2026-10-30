/**
 * UC-1223 B3 — `success` virtual'ı: 409 + idempotentSuccess başarılı sayılır (UC-569 Ö-4), düz 409 sayılmaz.
 * Doküman bağlantısız kurulur; virtual veritabanına dokunmaz.
 */
import mongoose from 'mongoose';
import { createIntegrationRequestLogModel } from '../integrationRequestLog.schema';

describe('IntegrationRequestLog success virtual', () => {
    const connection = mongoose.createConnection();
    createIntegrationRequestLogModel(connection);
    const Model: any = connection.model('IntegrationRequestLog');
    const success = (fields: Record<string, unknown>) => new Model(fields).success;

    it('409 + idempotentSuccess başarılı; idempotentSuccess olmayan 409 başarısız', () => {
        expect(success({ responseStatus: 409, idempotentSuccess: true })).toBe(true);
        expect(success({ responseStatus: 409 })).toBe(false);
        expect(success({ responseStatus: 409, idempotentSuccess: false })).toBe(false);
    });

    it('2xx başarılı, diğerleri ve statüsüz satır başarısız', () => {
        expect(success({ responseStatus: 200 })).toBe(true);
        expect(success({ responseStatus: 500, idempotentSuccess: true })).toBe(false);
        expect(success({})).toBe(false);
    });
});
