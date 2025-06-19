"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBooleanValidator = exports.isArrayValidator = exports.isNumberValidator = exports.isFloatValidator = exports.isDateValidator = exports.isEmailValidator = exports.isInBodyValidator = exports.isStringValidator = exports.isObjectValidator = void 0;
const bson_1 = require("bson");
const isObjectValidator = (value, params) => {
    let obj = {
        isObject: {
            errorMessage: `${value} must be object`
        },
        notEmpty: {
            errorMessage: `${value} is not empty`
        },
        errorMessage: `${value} object is required`
    };
    if (params) {
        if (params.isOptional) {
            delete obj.errorMessage;
            obj.optional = { nullable: true, checkFalsy: true };
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
            errorMessage: `${value} must be string`
        },
        notEmpty: {
            errorMessage: `${value} is not empty`
        },
        errorMessage: `${value} must be provided`
    };
    if (params) {
        if (params.isOptional) {
            delete obj.errorMessage;
            obj.optional = { nullable: true, checkFalsy: true };
        }
        if (params.notEmptyClose) {
            delete obj.notEmpty;
        }
        if (params.in) {
            obj.in = params.in;
        }
        if (params.minLength || params.minLength) {
            if (params.minLength && params.maxLength) {
                obj.isLength = {
                    options: { min: params.minLength, max: params.maxLength },
                    errorMessage: `${value} must be ${params.minLength} between ${params.maxLength} characters`
                };
            }
            else if (params.minLength) {
                obj.isLength = {
                    options: { min: params.minLength },
                    errorMessage: `${value} must be minimum ${params.minLength} characters`
                };
            }
            else if (params.maxLength) {
                obj.isLength = {
                    options: { max: params.maxLength },
                    errorMessage: `${value} must be maximum ${params.maxLength} characters`
                };
            }
        }
        if (params.isValidObject) {
            obj.custom = {
                options: (input) => bson_1.ObjectId.isValid(input),
                errorMessage: `${value} must be a valid ObjectId`,
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
            errorMessage: `Invalid ${value}. You can only send ( ${inArray.join(",")} )`,
        },
        errorMessage: `${value} must be provided`
    };
    if (params) {
        if (params.isOptional) {
            delete obj.errorMessage;
            obj.optional = { nullable: true, checkFalsy: true };
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
            errorMessage: `${value} must be mail format`,
        },
        errorMessage: `${value} must be provided`
    };
    if (params) {
        if (params.isOptional) {
            delete obj.errorMessage;
            obj.optional = { nullable: true, checkFalsy: true };
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
            errorMessage: `${value} must be date format`
        },
        notEmpty: {
            errorMessage: `${value} is not empty`
        },
        errorMessage: `${value} must be provided`
    };
    if (params) {
        if (params.isOptional) {
            delete obj.errorMessage;
            obj.optional = { nullable: true, checkFalsy: true };
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
            errorMessage: `${value} must be float value`
        },
        notEmpty: {
            errorMessage: `${value} is not empty`
        },
        errorMessage: `${value} must be provided`
    };
    if (params) {
        if (params.isOptional) {
            delete obj.errorMessage;
            obj.optional = { nullable: true, checkFalsy: true };
        }
        if (params.notEmptyClose) {
            delete obj.notEmpty;
        }
        if (params.in) {
            obj.in = params.in;
        }
        if (params.minLength || params.minLength) {
            if (params.minLength && params.maxLength) {
                obj.isFloat = {
                    options: { min: params.minLength, max: params.maxLength },
                    errorMessage: `${value} must be ${params.minLength} between ${params.maxLength} float value`
                };
            }
            else if (params.minLength) {
                obj.isFloat = {
                    options: { min: params.minLength },
                    errorMessage: `${value} must be minimum ${params.minLength} float value`
                };
            }
            else if (params.maxLength) {
                obj.isFloat = {
                    options: { max: params.maxLength },
                    errorMessage: `${value} must be maximum ${params.maxLength} float value`
                };
            }
        }
        if (params.matches) {
            obj.matches = {
                options: /^[0-9]{0,8}(\.[0-9]{1,3})?$/,
                errorMessage: 'Invalid float value, maximum 8 digits before the decimal point and maximum 3 digits after',
            };
        }
    }
    return obj;
};
exports.isFloatValidator = isFloatValidator;
const isNumberValidator = (value, params) => {
    let obj = {
        isNumeric: {
            errorMessage: `${value} must be number value`
        },
        notEmpty: {
            errorMessage: `${value} is not empty`
        },
        errorMessage: `${value} must be provided`
    };
    if (params) {
        if (params.isOptional) {
            delete obj.errorMessage;
            obj.optional = { nullable: true, checkFalsy: true };
        }
        if (params.notEmptyClose) {
            delete obj.notEmpty;
        }
        if (params.in) {
            obj.in = params.in;
        }
        if (params.minLength || params.minLength) {
            if (params.minLength && params.maxLength) {
                obj.isFloat = {
                    options: { min: params.minLength, max: params.maxLength },
                    errorMessage: `${value} must be ${params.minLength} between ${params.maxLength} number value`
                };
            }
            else if (params.minLength) {
                obj.isFloat = {
                    options: { min: params.minLength },
                    errorMessage: `${value} must be minimum ${params.minLength} number value`
                };
            }
            else if (params.maxLength) {
                obj.isFloat = {
                    options: { max: params.maxLength },
                    errorMessage: `${value} must be maximum ${params.maxLength} number value`
                };
            }
        }
        if (params.matches) {
            obj.matches = {
                options: /^[0-9]{0,8}(\.[0-9]{1,3})?$/,
                errorMessage: 'Invalid float value, maximum 8 digits before the decimal point and maximum 3 digits after',
            };
        }
    }
    return obj;
};
exports.isNumberValidator = isNumberValidator;
const isArrayValidator = (attr, params) => {
    let obj = {
        isArray: {
            errorMessage: `${attr} must be array`
        },
        notEmpty: {
            errorMessage: `${attr} is not empty`
        },
        custom: {
            options: (value, { req }) => {
                if (Array.isArray(value) && value.length === 0) {
                    throw new Error(`At least one ${value} must be provided`);
                }
                return true;
            }
        },
        errorMessage: `${attr} must be provided`
    };
    if (params) {
        if (params.isOptional) {
            delete obj.errorMessage;
            delete obj.custom;
            obj.optional = { nullable: true, checkFalsy: true };
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
                        throw new Error(`At least one ${attr} must be provided`);
                    }
                    for (var val of value) {
                        if (!bson_1.ObjectId.isValid(val)) {
                            throw new Error(`${attr} item is objectID`);
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
            errorMessage: `${value} must be boolean`
        },
        notEmpty: {
            errorMessage: `${value} is not empty`
        },
        errorMessage: `${value} must be provided`
    };
    if (params) {
        if (params.isOptional) {
            delete obj.errorMessage;
            obj.optional = { nullable: true, checkFalsy: true };
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
