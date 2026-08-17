import { checkSchema, validationResult } from 'express-validator';
import { Request } from 'express';
import {
    isArrayValidator,
    isBooleanValidator,
    isDateValidator,
    isEmailValidator,
    isFloatValidator,
    isInBodyValidator,
    isNumberValidator,
    isObjectValidator,
    isStringValidator
} from '../common/methods/validator';

/**
 * `isOptional` davranis testi (issue #625)
 *
 * Bu dosya SEMA CIKTISINI degil GERCEK DOGRULAMA DAVRANISINI olcuyor: uretilen sema
 * express-validator'in kendi `checkSchema` calistiricisina veriliyor ve sonuc okunuyor.
 * Sebep: 17/08/2026'ya kadar moon-lib `optional: { nullable, checkFalsy }` uretiyordu ve
 * bu bicim v7 sema API'sinde SESSIZCE YOK SAYILIYORDU — cikti "dogru gorunuyor" ama
 * davranis yanlisti. Bicime bakan bir test bunu yakalamazdi (#619'da tam olarak bu oldu).
 *
 * 🔴 TIP-DUYARLILIK: `values: 'falsy'` tum falsy degerleri "gonderilmedi" sayar — sayisal
 * `0` ve mantiksal `false` dahil. Metin alanlarinda dogru davranis budur; sayisal ve
 * mantiksal alanlarda ise bos string'in dogrulamayi atlatmasina yol acar ve route
 * `parseInt("")` = NaN alir. Bu yuzden metin tipleri `'falsy'`, digerleri `'null'`
 * kullaniyor. Asagidaki iki grup tam olarak bu ayrimi kilitliyor.
 */
const runValidation = async (schema: Record<string, any>, body: any) => {
    const req = { body, query: {}, params: {}, headers: {}, cookies: {} } as unknown as Request;
    await Promise.all(checkSchema(schema as any).map(chain => chain.run(req)));
    return validationResult(req);
};

const hasErrorFor = (result: any, field: string): boolean =>
    result.array().some((e: any) => e.path === field);

describe('moon-lib isOptional davranisi (issue #625)', () => {
    describe('METIN tipleri — bos string "gonderilmedi" sayilir', () => {
        const cases: Array<[string, Record<string, any>]> = [
            ['isStringValidator', { field: { ...isStringValidator('Field', { isOptional: true }) } }],
            ['isEmailValidator', { field: { ...isEmailValidator('Field', { isOptional: true }) } }],
            ['isDateValidator', { field: { ...isDateValidator('Field', { isOptional: true }) } }],
            ['isInBodyValidator', { field: { ...isInBodyValidator('Field', ['a', 'b'], { isOptional: true }) } }]
        ];

        it.each(cases)('%s — BOS STRING gecer (asil duzeltme)', async (_ad, schema) => {
            const result = await runValidation(schema, { field: '' });
            expect(hasErrorFor(result, 'field')).toBe(false);
        });

        it.each(cases)('%s — alan HIC gonderilmezse gecer', async (_ad, schema) => {
            const result = await runValidation(schema, {});
            expect(hasErrorFor(result, 'field')).toBe(false);
        });

        it.each(cases)('%s — null gecer', async (_ad, schema) => {
            const result = await runValidation(schema, { field: null });
            expect(hasErrorFor(result, 'field')).toBe(false);
        });
    });

    describe('SAYISAL / MANTIKSAL tipler — 0 ve false GERCEK deger, dogrulanir', () => {
        it('isNumberValidator — 0 gecerli sayidir ve GECER', async () => {
            const schema = { field: { ...isNumberValidator('Field', { isOptional: true }) } };
            const result = await runValidation(schema, { field: 0 });
            expect(hasErrorFor(result, 'field')).toBe(false);
        });

        it('🔴 isNumberValidator — BOS STRING REDDEDILIR (NaN korumasi)', async () => {
            // `values: 'falsy'` kullanilsa bu istek dogrulamayi ATLAR ve route
            // `parseInt("")` = NaN alirdi. `values: 'null'` sayesinde 400 doner.
            const schema = { field: { ...isNumberValidator('Field', { isOptional: true }) } };
            const result = await runValidation(schema, { field: '' });
            expect(hasErrorFor(result, 'field')).toBe(true);
        });

        it('isNumberValidator — alan HIC gonderilmezse gecer', async () => {
            const schema = { field: { ...isNumberValidator('Field', { isOptional: true }) } };
            const result = await runValidation(schema, {});
            expect(hasErrorFor(result, 'field')).toBe(false);
        });

        it('isFloatValidator — 0 GECER, bos string REDDEDILIR', async () => {
            const schema = { field: { ...isFloatValidator('Field', { isOptional: true }) } };
            expect(hasErrorFor(await runValidation(schema, { field: 0 }), 'field')).toBe(false);
            expect(hasErrorFor(await runValidation(schema, { field: '' }), 'field')).toBe(true);
        });

        it('isBooleanValidator — false GECER (tip kontrolu calisir), bos string REDDEDILIR', async () => {
            const schema = { field: { ...isBooleanValidator('Field', { isOptional: true }) } };
            expect(hasErrorFor(await runValidation(schema, { field: false }), 'field')).toBe(false);
            expect(hasErrorFor(await runValidation(schema, { field: '' }), 'field')).toBe(true);
        });

        it('isArrayValidator — bos dizi GECER, alan yoksa gecer', async () => {
            const schema = { field: { ...isArrayValidator('Field', { isOptional: true }) } };
            expect(hasErrorFor(await runValidation(schema, { field: [] }), 'field')).toBe(false);
            expect(hasErrorFor(await runValidation(schema, {}), 'field')).toBe(false);
        });

        it('isObjectValidator — alan yoksa gecer, bos string REDDEDILIR', async () => {
            const schema = { field: { ...isObjectValidator('Field', { isOptional: true }) } };
            expect(hasErrorFor(await runValidation(schema, {}), 'field')).toBe(false);
            expect(hasErrorFor(await runValidation(schema, { field: '' }), 'field')).toBe(true);
        });
    });

    describe('ZORUNLU alanlar zorunlu KALIR (regresyon)', () => {
        it('isStringValidator — isOptional YOKSA bos string REDDEDILIR', async () => {
            const schema = { field: { ...isStringValidator('Field') } };
            expect(hasErrorFor(await runValidation(schema, { field: '' }), 'field')).toBe(true);
        });

        it('isStringValidator — isOptional YOKSA alan eksikse REDDEDILIR', async () => {
            const schema = { field: { ...isStringValidator('Field') } };
            expect(hasErrorFor(await runValidation(schema, {}), 'field')).toBe(true);
        });

        it('isEmailValidator — opsiyonel ama DOLU gelirse bicim dogrulanir', async () => {
            const schema = { field: { ...isEmailValidator('Field', { isOptional: true }) } };
            expect(hasErrorFor(await runValidation(schema, { field: 'gecersiz' }), 'field')).toBe(true);
            expect(hasErrorFor(await runValidation(schema, { field: 'a@b.com' }), 'field')).toBe(false);
        });

        it('isStringValidator — opsiyonel ama DOLU gelirse uzunluk sinirlari uygulanir', async () => {
            const schema = {
                field: { ...isStringValidator('Field', { isOptional: true, minLength: 3, maxLength: 5 }) }
            };
            expect(hasErrorFor(await runValidation(schema, { field: 'ab' }), 'field')).toBe(true);
            expect(hasErrorFor(await runValidation(schema, { field: 'abcdef' }), 'field')).toBe(true);
            expect(hasErrorFor(await runValidation(schema, { field: 'abcd' }), 'field')).toBe(false);
            // bos string yine muaf
            expect(hasErrorFor(await runValidation(schema, { field: '' }), 'field')).toBe(false);
        });
    });

    describe('isOptional + isValidObject — ObjectId korumasi KALKMIYOR', () => {
        // Repoda bu kombinasyon yaygin (productId, categoryId, brandId... 40+ kullanim).
        // Kritik soru: bos string artik muaf oldugu icin ObjectId kontrolu de mi atlaniyor?
        // Cevap: HAYIR — yalnizca BOS deger muaf; dolu ama gecersiz deger reddedilmeye devam ediyor.
        const schema = {
            productId: { ...isStringValidator('Product id', { isOptional: true, isValidObject: true }) }
        };

        it('bos string GECER (filtre gonderilmedi demek)', async () => {
            expect(hasErrorFor(await runValidation(schema, { productId: '' }), 'productId')).toBe(false);
        });

        it('alan hic gonderilmezse GECER', async () => {
            expect(hasErrorFor(await runValidation(schema, {}), 'productId')).toBe(false);
        });

        it('🔒 GECERSIZ ObjectId REDDEDILIR — asil koruma duruyor', async () => {
            expect(hasErrorFor(await runValidation(schema, { productId: 'abc' }), 'productId')).toBe(true);
        });

        it('gecerli ObjectId GECER', async () => {
            const result = await runValidation(schema, { productId: '507f1f77bcf86cd799439011' });
            expect(hasErrorFor(result, 'productId')).toBe(false);
        });
    });

    describe('🟡 METIN tiplerinde 0 / false — BILINCLI gevseme, sinirlari kilitli', () => {
        // Guvenlik incelemesi bulgusu (issue #625): `values: 'falsy'` yalnizca bos string'i
        // degil TUM falsy degerleri muaf tutar; metin alanlarinda `0` ve `false` de artik
        // tip kontrolunu atliyor. Bu, duzeltmenin getirdigi YENI bir gevseme.
        //
        // Neden kabul edildi: express-validator `values` icin yalnizca uc secenek sunuyor
        // (`'undefined' | 'null' | 'falsy'`); "bos string'i muaf tut ama tipi yine kontrol et"
        // diye bir ara secenek YOK. `'null'`e dusulse bos string `notEmpty`ye takilir ve asil
        // amac (client bos formu `''` gonderiyor) karsilanmaz.
        //
        // Riskin siniri asagida olculuyor: NESNELER MUAF DEGIL, yani `{ $ne: ... }` gibi
        // operator enjeksiyonu hala reddediliyor. Kalan risk tip karisikligi (route `.trim()`
        // cagirirsa TypeError) — guvenlik degil dayaniklilik sorunu.
        const textSchema = { field: { ...isStringValidator('Field', { isOptional: true }) } };

        it('sayisal 0 metin alaninda GECER (gevseme — bilincli)', async () => {
            expect(hasErrorFor(await runValidation(textSchema, { field: 0 }), 'field')).toBe(false);
        });

        it('mantiksal false metin alaninda GECER (gevseme — bilincli)', async () => {
            expect(hasErrorFor(await runValidation(textSchema, { field: false }), 'field')).toBe(false);
        });

        it('🔒 NESNE REDDEDILIR — operator enjeksiyonu kapali', async () => {
            expect(hasErrorFor(await runValidation(textSchema, { field: { $ne: null } }), 'field')).toBe(true);
        });

        it('🔒 BOS NESNE ve DIZI de REDDEDILIR (truthy degiller ama string de degiller)', async () => {
            expect(hasErrorFor(await runValidation(textSchema, { field: {} }), 'field')).toBe(true);
            expect(hasErrorFor(await runValidation(textSchema, { field: [] }), 'field')).toBe(true);
        });

        it('SAYISAL alanda 0 zaten dogrulaniyor — gevseme SADECE metin tiplerinde', async () => {
            const numSchema = { field: { ...isNumberValidator('Field', { isOptional: true }) } };
            expect(hasErrorFor(await runValidation(numSchema, { field: 0 }), 'field')).toBe(false);
            expect(hasErrorFor(await runValidation(numSchema, { field: 'abc' }), 'field')).toBe(true);
        });
    });
});
