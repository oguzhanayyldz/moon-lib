/**
 * UC-1268: N11 hata gövdesi { code, errorCode, errorMessage } sipariş listesi gibi yorumlayıcılarda
 * "0 sipariş paketi getirildi / success" yazıyordu; istek günlüğü 400'ü başarı gösteriyordu.
 */
import { OperationType } from '../../../enums/operation-type.enum';
import { N11ResponseInterpreter } from '../n11.interpreter';

describe('N11ResponseInterpreter — hata gövdesi başarısız yorumlanır (UC-1268)', () => {
    const interpreter = new N11ResponseInterpreter();
    const AUTH_ERROR_BODY = {
        code: 400,
        errorCode: 'SELLER_API.authenticationFailed',
        errorMessage: 'Apide doğrulama işlemi başarısız oldu.'
    };

    it.each([OperationType.FETCH_ORDERS, OperationType.FETCH_PRODUCTS, OperationType.UPDATE_ORDER])(
        '%s: errorCode taşıyan gövde success:false',
        (op) => {
            const result = interpreter.interpret(AUTH_ERROR_BODY, op);
            expect(result).toEqual(expect.objectContaining({ success: false, failureCount: 1, successCount: 0 }));
            expect(result!.summary).toContain('SELLER_API.authenticationFailed');
        }
    );

    it('errorCode olmayan normal sipariş listesi etkilenmez', () => {
        const result = interpreter.interpret(
            { content: [{ shipmentPackageStatus: 'Shipped' }], totalPages: 1 },
            OperationType.FETCH_ORDERS
        );
        expect(result!.success).toBe(true);
        expect(result!.successCount).toBe(1);
    });
});
