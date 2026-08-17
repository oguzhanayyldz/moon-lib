"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBooleanValidator = exports.isArrayValidator = exports.isNumberValidator = exports.isFloatValidator = exports.isDateValidator = exports.isEmailValidator = exports.isInBodyValidator = exports.isStringValidator = exports.isObjectValidator = void 0;
const bson_1 = require("bson");
/**
 * `optional` ayarinin v7-UYUMLU bicimleri (issue #625)
 *
 * ⚠️ NEDEN: express-validator v7 sema API'si `optional`i
 * `boolean | { options?: OptionalOptions }` olarak bekliyor
 * (`express-validator/src/middlewares/schema.d.ts`). Bu dosya 17/08/2026'ya kadar
 * eski `{ nullable, checkFalsy }` bicimini uretiyordu — `options` SARMALAYICISI
 * olmadigi icin ayar sessizce yok sayiliyor ve alan varsayilana dusuyordu:
 * "yalnizca `undefined` opsiyoneldir". Sonuc: alan hic gonderilmezse geciyor ama
 * BOS STRING 400 aliyordu. Ayni hata uc issue'da (#609, #619, #613) servis
 * seviyesinde yerel sabitlerle yamalandi; burada kokten cozuluyor.
 * Eski iki anahtar v7 tip tanimda `@deprecated` — yerine `values` kullaniliyor
 * (`express-validator/src/chain/context-handler.d.ts:16`).
 *
 * 🔴 TIP-DUYARLI OLMAK ZORUNDA — tek bir deger TUM tipler icin dogru degil:
 * `values: 'falsy'` TUM falsy degerleri "gonderilmedi" sayar; buna sayisal `0` ve
 * mantiksal `false` de dahildir. Metin alanlarinda istenen davranis budur (client bos
 * formu `''` gonderir) ama sayisal/mantiksal alanlarda YENI HATA dogurur:
 *   - `{ limit: "" }` → dogrulama atlanir, route `parseInt("")` = NaN alir
 *     (oncesinde 400 donuyordu)
 *   - `{ isActive: false }` → tip kontrolu hic calismaz
 * Bu yuzden sayisal/mantiksal/yapisal tipler `values: 'null'` kullanir: yalnizca
 * `null` ve `undefined` "gonderilmedi" sayilir; `0` / `false` / `""` dogrulanir.
 */
/** Metin tipleri: bos string de "gonderilmedi" sayilir. */
const OPTIONAL_TEXT = { options: { values: 'falsy' } };
/** Sayisal / mantiksal / yapisal tipler: yalnizca null ve undefined "gonderilmedi" sayilir. */
const OPTIONAL_NULLISH = { options: { values: 'null' } };
const isObjectValidator = (value, params) => {
    let obj = {
        isObject: {
            errorMessage: `errors.validation.mustBeObject::${value}`
        },
        notEmpty: {
            errorMessage: `errors.validation.notEmpty::${value}`
        },
        errorMessage: `errors.validation.required::${value}`
    };
    if (params) {
        if (params.isOptional) {
            delete obj.errorMessage;
            obj.optional = OPTIONAL_NULLISH;
        }
        if (params.notEmptyClose) {
            delete obj.notEmpty;
        }
        if (params.in) {
            obj.in = params.in;
        }
    }
    return obj;
};
exports.isObjectValidator = isObjectValidator;
const isStringValidator = (value, params) => {
    let obj = {
        isString: {
            errorMessage: `errors.validation.mustBeString::${value}`
        },
        notEmpty: {
            errorMessage: `errors.validation.notEmpty::${value}`
        },
        errorMessage: `errors.validation.required::${value}`
    };
    if (params) {
        if (params.isOptional) {
            delete obj.errorMessage;
            obj.optional = OPTIONAL_TEXT;
        }
        if (params.notEmptyClose) {
            delete obj.notEmpty;
        }
        if (params.in) {
            obj.in = params.in;
        }
        if (params.minLength || params.maxLength) {
            if (params.minLength && params.maxLength) {
                obj.isLength = {
                    options: { min: params.minLength, max: params.maxLength },
                    errorMessage: `errors.validation.length::${value}::${params.minLength}::${params.maxLength}`
                };
            }
            else if (params.minLength) {
                obj.isLength = {
                    options: { min: params.minLength },
                    errorMessage: `errors.validation.minLength::${value}::${params.minLength}`
                };
            }
            else if (params.maxLength) {
                obj.isLength = {
                    options: { max: params.maxLength },
                    errorMessage: `errors.validation.maxLength::${value}::${params.maxLength}`
                };
            }
        }
        if (params.isValidObject) {
            obj.custom = {
                options: (input) => bson_1.ObjectId.isValid(input),
                errorMessage: `errors.validation.mustBeId::${value}`,
            };
        }
    }
    return obj;
};
exports.isStringValidator = isStringValidator;
const isInBodyValidator = (value, inArray, params) => {
    let obj = {
        isIn: {
            options: [inArray],
            errorMessage: `errors.validation.invalidValue::${value}::${inArray.join(",")}`,
        },
        errorMessage: `errors.validation.required::${value}`
    };
    if (params) {
        if (params.isOptional) {
            delete obj.errorMessage;
            obj.optional = OPTIONAL_TEXT;
        }
        if (params.in) {
            obj.in = params.in;
        }
    }
    return obj;
};
exports.isInBodyValidator = isInBodyValidator;
const isEmailValidator = (value, params) => {
    let obj = {
        isEmail: {
            errorMessage: `errors.validation.email::${value}`,
        },
        errorMessage: `errors.validation.required::${value}`
    };
    if (params) {
        if (params.isOptional) {
            delete obj.errorMessage;
            obj.optional = OPTIONAL_TEXT;
        }
        if (params.in) {
            obj.in = params.in;
        }
    }
    return obj;
};
exports.isEmailValidator = isEmailValidator;
const isDateValidator = (value, params) => {
    let obj = {
        isISO8601: {
            options: { format: "YYYY-MM-DD HH:mm:ss" },
            errorMessage: `errors.validation.mustBeDate::${value}`
        },
        notEmpty: {
            errorMessage: `errors.validation.notEmpty::${value}`
        },
        errorMessage: `errors.validation.required::${value}`
    };
    if (params) {
        if (params.isOptional) {
            delete obj.errorMessage;
            obj.optional = OPTIONAL_TEXT;
        }
        if (params.notEmptyClose) {
            delete obj.notEmpty;
        }
        if (params.in) {
            obj.in = params.in;
        }
    }
    return obj;
};
exports.isDateValidator = isDateValidator;
const isFloatValidator = (value, params) => {
    let obj = {
        isFloat: {
            errorMessage: `errors.validation.mustBeFloat::${value}`
        },
        notEmpty: {
            errorMessage: `errors.validation.notEmpty::${value}`
        },
        errorMessage: `errors.validation.required::${value}`
    };
    if (params) {
        if (params.isOptional) {
            delete obj.errorMessage;
            obj.optional = OPTIONAL_NULLISH;
        }
        if (params.notEmptyClose) {
            delete obj.notEmpty;
        }
        if (params.in) {
            obj.in = params.in;
        }
        if (params.minLength || params.maxLength) {
            if (params.minLength && params.maxLength) {
                obj.isFloat = {
                    options: { min: params.minLength, max: params.maxLength },
                    errorMessage: `errors.validation.range::${value}::${params.minLength}::${params.maxLength}`
                };
            }
            else if (params.minLength) {
                obj.isFloat = {
                    options: { min: params.minLength },
                    errorMessage: `errors.validation.min::${value}::${params.minLength}`
                };
            }
            else if (params.maxLength) {
                obj.isFloat = {
                    options: { max: params.maxLength },
                    errorMessage: `errors.validation.max::${value}::${params.maxLength}`
                };
            }
        }
        if (params.matches) {
            obj.matches = {
                options: /^[0-9]{0,8}(\.[0-9]{1,3})?$/,
                errorMessage: `errors.validation.invalidFloatFormat::${value}`,
            };
        }
    }
    return obj;
};
exports.isFloatValidator = isFloatValidator;
const isNumberValidator = (value, params) => {
    let obj = {
        isNumeric: {
            errorMessage: `errors.validation.mustBeNumber::${value}`
        },
        notEmpty: {
            errorMessage: `errors.validation.notEmpty::${value}`
        },
        errorMessage: `errors.validation.required::${value}`
    };
    if (params) {
        if (params.isOptional) {
            delete obj.errorMessage;
            obj.optional = OPTIONAL_NULLISH;
        }
        if (params.notEmptyClose) {
            delete obj.notEmpty;
        }
        if (params.in) {
            obj.in = params.in;
        }
        if (params.minLength || params.maxLength) {
            if (params.minLength && params.maxLength) {
                obj.isFloat = {
                    options: { min: params.minLength, max: params.maxLength },
                    errorMessage: `errors.validation.range::${value}::${params.minLength}::${params.maxLength}`
                };
            }
            else if (params.minLength) {
                obj.isFloat = {
                    options: { min: params.minLength },
                    errorMessage: `errors.validation.min::${value}::${params.minLength}`
                };
            }
            else if (params.maxLength) {
                obj.isFloat = {
                    options: { max: params.maxLength },
                    errorMessage: `errors.validation.max::${value}::${params.maxLength}`
                };
            }
        }
        if (params.matches) {
            obj.matches = {
                options: /^[0-9]{0,8}(\.[0-9]{1,3})?$/,
                errorMessage: `errors.validation.invalidFloatFormat::${value}`,
            };
        }
    }
    return obj;
};
exports.isNumberValidator = isNumberValidator;
const isArrayValidator = (attr, params) => {
    let obj = {
        isArray: {
            errorMessage: `errors.validation.mustBeArray::${attr}`
        },
        notEmpty: {
            errorMessage: `errors.validation.notEmpty::${attr}`
        },
        custom: {
            options: (value, { req }) => {
                if (Array.isArray(value) && value.length === 0) {
                    throw new Error(`errors.validation.arrayMinOne::${attr}`);
                }
                return true;
            }
        },
        errorMessage: `errors.validation.required::${attr}`
    };
    if (params) {
        if (params.isOptional) {
            delete obj.errorMessage;
            delete obj.custom;
            obj.optional = OPTIONAL_NULLISH;
        }
        if (params.notEmptyClose) {
            delete obj.notEmpty;
        }
        if (params.in) {
            obj.in = params.in;
        }
        if (params.notCustom) {
            delete obj.custom;
        }
        if (params.customArrayObjectControl) {
            obj.custom = {
                options: (value, { req }) => {
                    if (Array.isArray(value) && value.length === 0) {
                        throw new Error(`errors.validation.arrayMinOne::${attr}`);
                    }
                    for (var val of value) {
                        if (!bson_1.ObjectId.isValid(val)) {
                            throw new Error(`errors.validation.mustBeId::${attr}`);
                        }
                    }
                    return true;
                }
            };
        }
    }
    return obj;
};
exports.isArrayValidator = isArrayValidator;
const isBooleanValidator = (value, params) => {
    let obj = {
        isBoolean: {
            errorMessage: `errors.validation.mustBeBoolean::${value}`
        },
        notEmpty: {
            errorMessage: `errors.validation.notEmpty::${value}`
        },
        errorMessage: `errors.validation.required::${value}`
    };
    if (params) {
        if (params.isOptional) {
            delete obj.errorMessage;
            obj.optional = OPTIONAL_NULLISH;
        }
        if (params.notEmptyClose) {
            delete obj.notEmpty;
        }
        if (params.toBoolean) {
            obj.toBoolean = true;
        }
    }
    return obj;
};
exports.isBooleanValidator = isBooleanValidator;
//# sourceMappingURL=validator.js.map