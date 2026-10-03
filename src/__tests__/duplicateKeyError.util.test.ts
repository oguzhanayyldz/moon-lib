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

    it('MongoServerError (modern sürücü) + code 11000 → true (ad bağımsız)', () => {
        const err = Object.assign(new Error('boom'), { name: 'MongoServerError', code: 11000 });
        expect(isDuplicateKeyError(err)).toBe(true);
    });

    it('MongoBulkWriteError: writeErrors içinde 11000 → true', () => {
        const err = Object.assign(new Error('bulk'), { name: 'MongoBulkWriteError', writeErrors: [{ code: 11000 }] });
        expect(isDuplicateKeyError(err)).toBe(true);
    });

    it('result.writeErrors içinde 11000 (err sarmalı) → true', () => {
        const err = Object.assign(new Error('bulk'), { result: { writeErrors: [{ err: { code: 11000 } }] } });
        expect(isDuplicateKeyError(err)).toBe(true);
    });

    it('writeErrors var ama kodlar 11000 değil → false', () => {
        const err = Object.assign(new Error('bulk'), { writeErrors: [{ code: 121 }] });
        expect(isDuplicateKeyError(err)).toBe(false);
    });

    it.each([
        'E11000 duplicate key error collection: x index: y',
        'insertDocument :: caused by :: 11000 E11000 foo',
    ])('Mongo mesaj kalıbı (kodsuz sarmal) "%s" → true', (message) => {
        expect(isDuplicateKeyError(new Error(message))).toBe(true);
    });

    it.each([
        'duplicate key',
        'something duplicate happened',
        'duplicate delivery detected',
        'uniqueCode already used',
        'duplicate key value violates unique constraint',
    ])('yalnız genel "duplicate" ifadesi geçen "%s" → false (olay kaybı olmasın)', (message) => {
        expect(isDuplicateKeyError(new Error(message))).toBe(false);
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
