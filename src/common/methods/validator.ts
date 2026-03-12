import { ObjectId } from 'bson';
import { ValidatorFuncParams } from "../interfaces/validator-func-params.interface";

export const isObjectValidator = (value: string, params?: ValidatorFuncParams): any => {
    let obj: any = {
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

export const isStringValidator = (value: string, params?: ValidatorFuncParams): any => {
    let obj: any = {
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
            obj.optional = { nullable: true, checkFalsy: true };
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
                options: (input: any) => ObjectId.isValid(input),
                errorMessage: `errors.validation.mustBeId::${value}`,
            };
        }
    }

    return obj;
};

export const isInBodyValidator = (value: string, inArray: string[], params?: ValidatorFuncParams): any => {
    let obj: any = {
        isIn: {
            options: [inArray],
            errorMessage: `errors.validation.invalidValue::${value}::${inArray.join(",")}`,
        },
        errorMessage: `errors.validation.required::${value}`
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

export const isEmailValidator = (value: string, params?: ValidatorFuncParams): any => {
    let obj: any = {
        isEmail: {
            errorMessage: `errors.validation.email::${value}`,
        },
        errorMessage: `errors.validation.required::${value}`
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

export const isDateValidator = (value: string, params?: ValidatorFuncParams): any => {
    let obj: any = {
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

export const isFloatValidator = (value: string, params?: ValidatorFuncParams): any => {
    let obj: any = {
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
            obj.optional = { nullable: true, checkFalsy: true };
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

export const isNumberValidator = (value: string, params?: ValidatorFuncParams): any => {
    let obj: any = {
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
            obj.optional = { nullable: true, checkFalsy: true };
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

export const isArrayValidator = (attr: string, params?: ValidatorFuncParams): any => {
    let obj: any = {
        isArray: {
            errorMessage: `errors.validation.mustBeArray::${attr}`
        },
        notEmpty: {
            errorMessage: `errors.validation.notEmpty::${attr}`
        },
        custom: {
            options: (value: any, { req }: { req: any }) => {
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
                options: (value: any, { req }: { req: any }) => {
                    if (Array.isArray(value) && value.length === 0) {
                        throw new Error(`errors.validation.arrayMinOne::${attr}`);
                    }
                    for (var val of value) {
                        if (!ObjectId.isValid(val)) {
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

export const isBooleanValidator = (value: string, params?: ValidatorFuncParams): any => {
    let obj: any = {
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
