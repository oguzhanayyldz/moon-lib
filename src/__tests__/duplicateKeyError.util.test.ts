import { isDuplicateKeyError } from '../utils/duplicateKeyError.util';

describe('isDuplicateKeyError', () => {
    it('MongoError + code 11000 → true (mesajdan bağımsız)', () => {
        const err = Object.assign(new Error('boom'), { name: 'MongoError', code: 11000 });
        expect(isDuplicateKeyError(err)).toBe(true);
    });

    it('MongoError ama farklı kod ve ilgisiz mesaj → false', () => {
        const err = Object.assign(new Error('boom'), { name: 'MongoError', code: 12345 });
        expect(isDuplicateKeyError(err)).toBe(false);
    });

    it('kod 11000 ama name MongoError değil ve mesaj ilgisiz → false', () => {
        const err = Object.assign(new Error('boom'), { name: 'MongoServerError', code: 11000 });
        expect(isDuplicateKeyError(err)).toBe(false);
    });

    it.each([
        'E11000 duplicate key error collection: x index: y',
        'insertDocument :: caused by :: 11000 E11000 foo',
        'duplicate key',
        'something duplicate happened',
        'uniqueCode already used',
    ])('mesaj varyantı "%s" → true', (message) => {
        expect(isDuplicateKeyError(new Error(message))).toBe(true);
    });

    it('ilgisiz Error → false', () => {
        expect(isDuplicateKeyError(new Error('connection reset'))).toBe(false);
    });

    it.each([null, undefined, 'E11000 duplicate key', { message: 'E11000', code: 11000 }, 11000])(
        'Error olmayan değer %p → false',
        (value) => {
            expect(isDuplicateKeyError(value)).toBe(false);
        },
    );
});
