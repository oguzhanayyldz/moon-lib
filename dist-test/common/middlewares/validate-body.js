"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBody = void 0;
const express_validator_1 = require("express-validator");
const request_validation_error_1 = require("../errors/request-validation-error");
const validateBody = (schema) => {
    // checkSchema tarafından döndürülen validasyonları bir middleware içinde çalıştır
    const validations = (0, express_validator_1.checkSchema)(schema);
    // Tek bir middleware fonksiyonu olarak tüm işlemleri döndür
    return (req, res, next) => {
        // Öncelikle checkSchema validasyonlarını çalıştır
        Promise.all(validations.map(validation => validation.run(req))).then(() => {
            // validationResult ile hataları kontrol et
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                throw new request_validation_error_1.RequestValidationError(errors.array());
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
            const extraFields = Object.keys(req.body).filter((field) => !desiredResult.find(x => x.key === field && (x.in === "body" || x.in === undefined)));
            if (extraFields.length > 0) {
                let validationError = [{ msg: `Tanımlanmayan alanlar: ${extraFields.join(', ')}` }];
                throw new request_validation_error_1.RequestValidationError(validationError);
            }
            const extraFieldsQuery = Object.keys(req.query).filter((field) => !desiredResult.find(x => x.key === field && x.in === "query"));
            if (extraFieldsQuery.length > 0) {
                let validationError = [{ msg: `Tanımlanmayan alanlar: ${extraFieldsQuery.join(', ')}` }];
                throw new request_validation_error_1.RequestValidationError(validationError);
            }
            const extraFieldsParams = Object.keys(req.params).filter((field) => !desiredResult.find(x => x.key === field && x.in === "params"));
            if (extraFieldsParams.length > 0) {
                let validationError = [{ msg: `Tanımlanmayan alanlar: ${extraFieldsParams.join(', ')}` }];
                throw new request_validation_error_1.RequestValidationError(validationError);
            }
            // Her şey geçerliyse, sonraki middleware'e geç
            next();
        }).catch(next); // Hata oluşursa, Express'e hata yönetimine geç
    };
};
exports.validateBody = validateBody;
//# sourceMappingURL=validate-body.js.map