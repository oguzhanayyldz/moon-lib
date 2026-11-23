/**
 * UC-2225: HB interpreter 5xx/4xx, boş errors dizisi, priceValidations ve zarf code≠0 durumlarını
 * "success:true / işlemi tamamlandı" yazıyordu; istek günlüğü panelinde yanıltıcı başarı görünüyordu.
 */
import { OperationType } from '../../../enums/operation-type.enum';
import { HepsiburadaResponseInterpreter } from '../hepsiburada.interpreter';

describe('HepsiburadaResponseInterpreter — hata durumları başarısız yorumlanır (UC-2225)', () => {
    const interpreter = new HepsiburadaResponseInterpreter();

    describe('(a) HTTP durumu', () => {
        it.each([400, 404, 429, 500, 502, 503])('HTTP %i: gövde ne olursa olsun success:false', (status) => {
            const result = interpreter.interpret({ message: 'Internal Server Error' }, OperationType.UPDATE_STOCK, status);
            expect(result).toEqual(expect.objectContaining({ success: false, failureCount: 1, successCount: 0 }));
            expect(result!.summary).toContain(`HTTP ${status}`);
        });

        it('5xx: success:true taşıyan gövde bile başarı sayılmaz', () => {
            const result = interpreter.interpret({ success: true }, OperationType.SEND_PRODUCTS, 500);
            expect(result!.success).toBe(false);
        });

        it('5xx: trackingId taşıyan gövde başarı sayılmaz', () => {
            const result = interpreter.interpret({ trackingId: 'abc' }, OperationType.CREATE_BATCH_REQUEST, 503);
            expect(result!.success).toBe(false);
        });

        it('2xx ve durum verilmemiş çağrı eskisi gibi çalışır', () => {
            expect(interpreter.interpret({ trackingId: 'abc' }, OperationType.CREATE_BATCH_REQUEST, 200)!.success).toBe(true);
            expect(interpreter.interpret({ trackingId: 'abc' }, OperationType.CREATE_BATCH_REQUEST)!.success).toBe(true);
        });
    });

    describe('(b) boş errors dizisi hata sayılmaz', () => {
        it('stok/fiyat: errors: [] + gövde başarılı → success:true', () => {
            const result = interpreter.interpret({ errors: [], itemCount: 2 }, OperationType.UPDATE_STOCK, 200);
            expect(result!.success).toBe(true);
            expect(result!.summary).not.toContain('başarısız');
        });

        it('stok/fiyat: dolu errors → success:false, ilk mesaj özette', () => {
            const result = interpreter.interpret({ errors: [{ message: 'SKU bulunamadı' }] }, OperationType.UPDATE_STOCK, 200);
            expect(result!.success).toBe(false);
            expect(result!.summary).toContain('SKU bulunamadı');
        });

        it('ürün gönderimi: errors: [] → hata dalına düşmez', () => {
            const result = interpreter.interpret({ errors: [], success: true }, OperationType.SEND_PRODUCTS, 200);
            expect(result!.success).toBe(true);
            expect(result!.summary).not.toContain('başarısız');
        });

        it('ürün gönderimi: dolu errors → success:false', () => {
            const result = interpreter.interpret({ errors: [{ message: 'Geçersiz kategori' }] }, OperationType.SEND_PRODUCTS, 200);
            expect(result!.success).toBe(false);
            expect(result!.summary).toContain('Geçersiz kategori');
        });
    });

    describe('(c) status:"Done" + priceValidations', () => {
        const body = {
            id: 'ac12c7ea',
            status: 'Done',
            errors: [],
            priceValidations: [{ elementNo: 1, hepsiburadaSku: 'HBV1', type: 'MIN_LOCK', description: 'Fiyat alt sınırın altında' }]
        };

        it.each([OperationType.UPDATE_PRICES, OperationType.UPDATE_STOCK_AND_PRICE])('%s: success:false + kısmi sayım', (op) => {
            const result = interpreter.interpret(body, op, 200);
            expect(result!.success).toBe(false);
            expect(result!.failureCount).toBe(1);
            expect(result!.summary).toContain('Fiyat alt sınırın altında');
        });

        it('priceValidations boşsa Done yanıtı başarılıdır', () => {
            const result = interpreter.interpret({ id: 'x', status: 'Done', errors: [], priceValidations: [] }, OperationType.UPDATE_PRICES, 200);
            expect(result!.success).toBe(true);
        });
    });

    describe('(d) zarf code≠0', () => {
        it.each([OperationType.UPDATE_STOCK, OperationType.SEND_PRODUCTS, OperationType.CREATE_PACKAGE])(
            '%s: code=1001 → success:false',
            (op) => {
                const result = interpreter.interpret({ code: 1001, message: 'Yetkisiz' }, op, 200);
                expect(result!.success).toBe(false);
                expect(result!.summary).toContain('Yetkisiz');
            }
        );

        it('code=0 başarısızlık sayılmaz', () => {
            const result = interpreter.interpret({ code: 0, success: true }, OperationType.SEND_PRODUCTS, 200);
            expect(result!.success).toBe(true);
        });
    });
});
