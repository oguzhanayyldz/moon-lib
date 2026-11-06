import { ItemErrorCollector } from '../utils/itemErrorCollector.util';

const named = (name: string, message = 'boom', extra: object = {}) => Object.assign(new Error(message), { name, ...extra });

const thrownBy = (c: ItemErrorCollector): unknown => {
    try {
        c.throwIfAny();
    } catch (e) {
        return e;
    }
    return undefined;
};

describe('ItemErrorCollector', () => {
    it('hata yoksa fırlatmaz', () => {
        expect(thrownBy(new ItemErrorCollector())).toBeUndefined();
    });

    it('tek geçici hata → orijinal nesneyle fırlatılır (sarma yok)', () => {
        const c = new ItemErrorCollector();
        const err = named('MongoNetworkError');
        expect(c.record(err)).toBe(true);
        expect(thrownBy(c)).toBe(err);
    });

    it('çoklu geçici hata → ilki fırlatılır', () => {
        const c = new ItemErrorCollector();
        const first = named('MongoNetworkError', 'ilk');
        c.record(first);
        c.record(named('MongoTimeoutError', 'ikinci'));
        expect(thrownBy(c)).toBe(first);
    });

    it('dup-key önceliği: dup-key önce gelse bile geçici hata fırlatılır', () => {
        const c = new ItemErrorCollector();
        const dup = named('MongoServerError', 'E11000 duplicate key', { code: 11000 });
        const transient = named('MongoNetworkError');
        c.record(dup);
        c.record(transient);
        expect(thrownBy(c)).toBe(transient);
    });

    it('yalnız dup-key → ham nesne (ad + code korunur) fırlatılır', () => {
        const c = new ItemErrorCollector();
        const dup = named('MongoServerError', 'E11000 duplicate key', { code: 11000 });
        c.record(dup);
        const thrown = thrownBy(c);
        expect(thrown).toBe(dup);
        expect((thrown as { code?: number }).code).toBe(11000);
    });

    it('deterministik hata → yutulur (record false), fırlatılmaz', () => {
        const c = new ItemErrorCollector();
        expect(c.record(named('CastError'))).toBe(false);
        expect(c.record(named('ValidationError'))).toBe(false);
        expect(thrownBy(c)).toBeUndefined();
    });

    it('deterministik + geçici karışık → yalnız geçici fırlatılır', () => {
        const c = new ItemErrorCollector();
        const transient = named('MongoNetworkError');
        c.record(named('CastError'));
        c.record(transient);
        expect(thrownBy(c)).toBe(transient);
    });
});
