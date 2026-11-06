import { BadRequestError } from '../common/errors/bad-request-error';

describe('BadRequestError details', () => {
    it('details verilmezse gövde eski biçimle birebir aynı', () => {
        expect(new BadRequestError('x').serializeErrors()).toEqual([{ message: 'x' }]);
        expect(Object.keys(new BadRequestError('x').serializeErrors()[0])).toEqual(['message']);
    });

    it('details verilirse gövdeye taşınır', () => {
        const details = { skipped: [{ platform: 'trendyol', reason: 'noCredentials' }] };
        expect(new BadRequestError('x', details).serializeErrors()).toEqual([{ message: 'x', details }]);
    });
});
