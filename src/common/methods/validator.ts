import { ObjectId } from 'bson';
import { ValidatorFuncParams } from "../interfaces/validator-func-params.interface";

export const isObjectValidator = (value: string, params?: ValidatorFuncParams): any => {
    let obj: any = {
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

export const isStringValidator = (value: string, params?: ValidatorFuncParams): any => {
    let obj: any = {
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
                options: (input: any) => ObjectId.isValid(input),
                errorMessage: `${value} must be a valid ObjectId`,
            };
        }
    }

    return obj;
};

export const isInBodyValidator = (value: string, inArray: string[], params?: ValidatorFuncParams): any => {
    let obj: any = {
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

export const isEmailValidator = (value: string, params?: ValidatorFuncParams): any => {
    let obj: any = {
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

export const isDateValidator = (value: string, params?: ValidatorFuncParams): any => {
    let obj: any = {
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

export const isFloatValidator = (value: string, params?: ValidatorFuncParams): any => {
    let obj: any = {
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

export const isNumberValidator = (value: string, params?: ValidatorFuncParams): any => {
    let obj: any = {
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

export const isArrayValidator = (attr: string, params?: ValidatorFuncParams): any => {
    let obj: any = {
        isArray: {
            errorMessage: `${attr} must be array`
        },
        notEmpty: {
            errorMessage: `${attr} is not empty`
        },
        custom: {
            options: (value: any, { req }: { req: any }) => {
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
                options: (value: any, { req }: { req: any }) => {
                    if (Array.isArray(value) && value.length === 0) {
                        throw new Error(`At least one ${attr} must be provided`);
                    }
                    for (var val of value) {
                        if (!ObjectId.isValid(val)) {
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

export const isBooleanValidator = (value: string, params?: ValidatorFuncParams): any => {
    let obj: any = {
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
