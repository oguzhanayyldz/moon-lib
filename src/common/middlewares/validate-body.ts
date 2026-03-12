import { Request, Response, NextFunction } from 'express';
import { Schema, checkSchema, validationResult } from 'express-validator';
import { RequestValidationError } from '../errors/request-validation-error';

const sanitizeFieldName = (field: string): string =>
    field.replace(/[^a-zA-Z0-9_.\-\[\]]/g, '').slice(0, 64);

export const validateBody = (schema: Schema) => {
    // checkSchema tarafından döndürülen validasyonları bir middleware içinde çalıştır
    const validations = checkSchema(schema);

    // Tek bir middleware fonksiyonu olarak tüm işlemleri döndür
    return (req: Request, res: Response, next: NextFunction) => {
        // Öncelikle checkSchema validasyonlarını çalıştır
        Promise.all(validations.map(validation => validation.run(req))).then(() => {
            // validationResult ile hataları kontrol et
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new RequestValidationError(errors.array());
            }

            const possibleInValues = ["query", "params", "body", undefined];
            const filteredKeys = Object.keys(schema).filter((key) => {
                const attributeSchema = schema[key];
                return possibleInValues.some((possibleInValue) => attributeSchema.in === possibleInValue);
            });

            const desiredResult = filteredKeys.map((key) => {
                // Anahtarları istediğiniz formata dönüştürün (örneğin, nesne veya dizi)
                return { key, in: schema[key].in };
            });
            
            // Tanımlanmayan alanları kontrol et
            const extraFields = Object.keys(req.body).filter((field) => !desiredResult.find(x => x.key === field && (x.in === "body" || x.in === undefined))).map(sanitizeFieldName);
            if (extraFields.length > 0) {
                let validationError: any = [{ msg: `errors.validation.unknownFields::${extraFields.join(', ')}` }];
                throw new RequestValidationError (validationError);
            }

            const extraFieldsQuery = Object.keys(req.query).filter((field) => !desiredResult.find(x => x.key === field && x.in === "query")).map(sanitizeFieldName);
            if (extraFieldsQuery.length > 0) {
                let validationError: any = [{ msg: `errors.validation.unknownFields::${extraFieldsQuery.join(', ')}` }];
                throw new RequestValidationError (validationError);
            }

            const extraFieldsParams = Object.keys(req.params).filter((field) => !desiredResult.find(x => x.key === field && x.in === "params")).map(sanitizeFieldName);
            if (extraFieldsParams.length > 0) {
                let validationError: any = [{ msg: `errors.validation.unknownFields::${extraFieldsParams.join(', ')}` }];
                throw new RequestValidationError (validationError);
            }
            // Her şey geçerliyse, sonraki middleware'e geç
            next();
        }).catch(next); // Hata oluşursa, Express'e hata yönetimine geç
    };
};
